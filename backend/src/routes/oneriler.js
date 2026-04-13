import express from "express";
import pool from "../db.js";
import { requireAuth, requireRole } from "../middleware/auth.js";

const router = express.Router();

/**
 * POST /api/oneriler
 * Akademik V1:
 * - Aday noktalar: en yüksek skorlu K mahalle (PointOnSurface)
 * - Metrikler:
 *   1) toplam_iyilesme = Σ (skor_once - skor_sonra)
 *   2) nufus_agirlikli_iyilesme = Σ (iyilesme_puani * nufus)
 *   3) kritikten_cikan = count(once>=80 && sonra<80)
 */
router.post("/", requireAuth, requireRole("admin", "analyst"), async (req, res) =>  {
  try {
    const { tur, radius_m, aday_sayisi, top_n, alt_tur } = req.body ?? {};
const hizmetAltTur = typeof alt_tur === "string" ? alt_tur.trim().toLowerCase() : null;

    const allowed = new Set(["okul", "park", "saglik"]);
    const t = typeof tur === "string" ? tur.trim().toLowerCase() : "okul";
    const hizmetTur = allowed.has(t) ? t : "okul";

    const radius = typeof radius_m === "number" ? radius_m : 5000;

    const adaySayisi =
      typeof aday_sayisi === "number" ? Math.max(5, Math.min(100, aday_sayisi)) : 20;

    const topN = typeof top_n === "number" ? Math.max(1, Math.min(20, top_n)) : 5;

    const sql = `
      WITH
      n AS (SELECT * FROM norm_params),

      adaylar AS (
        SELECT
          m.ad AS aday_mahalle,
          ST_PointOnSurface(m.geom) AS geom_pt,
          ST_X(ST_PointOnSurface(m.geom))::numeric(10,6) AS lon,
          ST_Y(ST_PointOnSurface(m.geom))::numeric(10,6) AS lat,
          s.yetersizlik_skoru_0_100 AS aday_skor
        FROM mahalleler_clean m
        JOIN mahalle_skor_sabit_view s ON s.ad = m.ad
        WHERE m.geom IS NOT NULL
        ORDER BY s.yetersizlik_skoru_0_100 DESC
        LIMIT $2
      )

      SELECT
        a.aday_mahalle,
        a.lon,
        a.lat,
        ROUND(a.aday_skor::numeric, 2) AS aday_skor,

        COALESCE(sim.etkilenen_mahalle_sayisi, 0) AS etkilenen_mahalle_sayisi,
        COALESCE(sim.toplam_iyilesme, 0) AS toplam_iyilesme,
        COALESCE(sim.nufus_agirlikli_iyilesme, 0) AS nufus_agirlikli_iyilesme,
        COALESCE(sim.kritikten_cikan, 0) AS kritikten_cikan,
        COALESCE(sim.top_etki, '[]'::jsonb) AS top_etki

      FROM adaylar a

      LEFT JOIN LATERAL (
        WITH
        p AS (
          SELECT ST_SetSRID(ST_MakePoint(a.lon, a.lat), 4326)::geography AS geog
        ),

        d AS (
  SELECT
    x.ad,
    x.nufus,
    x.nufus_yogunlugu_km2,
    x.en_yakin_park_m,
    x.en_yakin_okul_m,
    x.en_yakin_saglik_m,

    CASE
      WHEN $1 = 'okul'   THEN x.en_yakin_okul_m
      WHEN $1 = 'park'   THEN x.en_yakin_park_m
      WHEN $1 = 'saglik' THEN x.en_yakin_saglik_m
      ELSE x.en_yakin_okul_m
    END AS once_hizmet_m,

    x.yeni_hizmet_m,

    CASE
      WHEN $1 = 'okul' THEN
        LEAST(x.en_yakin_okul_m, x.yeni_hizmet_m)

      WHEN $1 = 'park' THEN
        LEAST(x.en_yakin_park_m, x.yeni_hizmet_m)

      WHEN $1 = 'saglik' THEN
        LEAST(x.en_yakin_saglik_m, x.yeni_hizmet_m)

      ELSE
        LEAST(x.en_yakin_okul_m, x.yeni_hizmet_m)
    END AS sonra_hizmet_m

  FROM (
    SELECT
      v.ad,
      v.nufus,
      v.nufus_yogunlugu_km2,
      v.en_yakin_park_m,

      CASE
        WHEN $1 = 'okul' AND NULLIF($5, '') IS NOT NULL THEN (
          SELECT MIN(
            ST_Distance(
              ST_PointOnSurface(m.geom)::geography,
              h.geom::geography
            )
          )
          FROM hizmet_noktalari h
          WHERE h.tur = 'okul'
            AND h.alt_tur = $5
        )
        ELSE v.en_yakin_okul_m
      END AS en_yakin_okul_m,

      CASE
        WHEN $1 = 'saglik' AND NULLIF($5, '') IS NOT NULL THEN (
          SELECT MIN(
            ST_Distance(
              ST_PointOnSurface(m.geom)::geography,
              h.geom::geography
            )
          )
          FROM hizmet_noktalari h
          WHERE h.tur = 'saglik'
            AND h.alt_tur = $5
        )
        ELSE v.en_yakin_saglik_m
      END AS en_yakin_saglik_m,

      ROUND(
        ST_Distance(ST_PointOnSurface(m.geom)::geography, p.geog)
      )::numeric AS yeni_hizmet_m

    FROM mahalle_analiz_view v
    JOIN mahalleler_clean m ON m.ad = v.ad
    CROSS JOIN p
    WHERE ST_DWithin(m.geom::geography, p.geog, $3)
  ) x
),

skorlar AS (
  SELECT
    d.*,

    ROUND((
      0.35 * ((d.nufus_yogunlugu_km2 - n.min_ny) / NULLIF((n.max_ny - n.min_ny), 0)) +
      0.20 * ((d.en_yakin_park_m     - n.min_park) / NULLIF((n.max_park - n.min_park), 0)) +
      0.25 * ((d.en_yakin_okul_m     - n.min_okul) / NULLIF((n.max_okul - n.min_okul), 0)) +
      0.20 * ((d.en_yakin_saglik_m   - n.min_saglik) / NULLIF((n.max_saglik - n.min_saglik), 0))
    )::numeric * 100, 2) AS skor_once,

    ROUND((
      0.35 * ((d.nufus_yogunlugu_km2 - n.min_ny) / NULLIF((n.max_ny - n.min_ny), 0)) +
      0.20 * (
        CASE
          WHEN $1 = 'park' THEN ((d.sonra_hizmet_m - n.min_park) / NULLIF((n.max_park - n.min_park), 0))
          ELSE ((d.en_yakin_park_m   - n.min_park) / NULLIF((n.max_park - n.min_park), 0))
        END
      ) +
      0.25 * (
        CASE
          WHEN $1 = 'okul' THEN ((d.sonra_hizmet_m - n.min_okul) / NULLIF((n.max_okul - n.min_okul), 0))
          ELSE ((d.en_yakin_okul_m   - n.min_okul) / NULLIF((n.max_okul - n.min_okul), 0))
        END
      ) +
      0.20 * (
        CASE
          WHEN $1 = 'saglik' THEN ((d.sonra_hizmet_m - n.min_saglik) / NULLIF((n.max_saglik - n.min_saglik), 0))
          ELSE ((d.en_yakin_saglik_m - n.min_saglik) / NULLIF((n.max_saglik - n.min_saglik), 0))
        END
      )
    )::numeric * 100, 2) AS skor_sonra

  FROM d
  CROSS JOIN n
),


        fark AS (
          SELECT
            ad,
            nufus,
            skor_once,
            skor_sonra,
            ROUND(skor_once - skor_sonra, 2) AS iyilesme_puani
          FROM skorlar
          WHERE skor_once <> skor_sonra
        )

        SELECT
          COUNT(*) AS etkilenen_mahalle_sayisi,
          ROUND(COALESCE(SUM(iyilesme_puani), 0), 2) AS toplam_iyilesme,
          ROUND(COALESCE(SUM(iyilesme_puani * nufus), 0), 2) AS nufus_agirlikli_iyilesme,
          COUNT(*) FILTER (WHERE skor_once >= 80 AND skor_sonra < 80) AS kritikten_cikan,
          (
            SELECT COALESCE(
              jsonb_agg(
                jsonb_build_object(
                  'ad', x.ad,
                  'nufus', x.nufus,
                  'skor_once', x.skor_once,
                  'skor_sonra', x.skor_sonra,
                  'iyilesme_puani', x.iyilesme_puani
                )
              ),
              '[]'::jsonb
            )
            FROM (
              SELECT * FROM fark
              ORDER BY iyilesme_puani DESC
              LIMIT 5
            ) x
          ) AS top_etki
        FROM fark
      ) sim ON TRUE

      ORDER BY nufus_agirlikli_iyilesme DESC, toplam_iyilesme DESC
      LIMIT $4;
    `;

    const { rows } = await pool.query(sql, [hizmetTur, adaySayisi, radius, topN, hizmetAltTur]);

    res.json({
      input: { tur: hizmetTur, radius_m: radius, aday_sayisi: adaySayisi, top_n: topN },
      oneriler: rows,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "oneriler hata", detail: err.message });
  }
});

export default router;
