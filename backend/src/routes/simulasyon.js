import express from "express";
import pool from "../db.js";
import { requireAuth, requireRole } from "../middleware/auth.js";

const router = express.Router();

const allowedTur = new Set(["okul", "park", "saglik"]);
const allowedMode = new Set(["genel", "tur"]);

const pickTur = (x) => {
  const t = typeof x === "string" ? x.trim().toLowerCase() : "okul";
  return allowedTur.has(t) ? t : "okul";
};

const pickMode = (x) => {
  const m = typeof x === "string" ? x.trim().toLowerCase() : "genel";
  return allowedMode.has(m) ? m : "genel";
};

router.post("/", requireAuth, requireRole("admin", "analyst"), async (req, res) => {
  try {
    const { lon, lat, radius_m, tur, mode } = req.body;

    if (typeof lon !== "number" || typeof lat !== "number") {
      return res.status(400).json({ error: "lon ve lat number olmalı" });
    }

    const radius = typeof radius_m === "number" ? radius_m : 1500;
    const hizmetTur = pickTur(tur);
    const mapMode = pickMode(mode); // ✅ frontend'ten geliyor (genel | tur)

    // ✅ Varsayılan MCDA ağırlıkları
    let w_ny = 0.35;
    let w_park = 0.20;
    let w_okul = 0.25;
    let w_saglik = 0.20;

    // ✅ Seçili tür modunda sadece tek metrik aktif
    if (mapMode === "tur") {
      w_ny = 0;
      w_park = hizmetTur === "park" ? 1 : 0;
      w_okul = hizmetTur === "okul" ? 1 : 0;
      w_saglik = hizmetTur === "saglik" ? 1 : 0;
    }

    const sql = `
WITH
p AS (
  SELECT ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography AS geog
),
n AS (SELECT * FROM norm_params),

d AS (
  SELECT
    v.ad,
    v.nufus_yogunlugu_km2,
    v.en_yakin_park_m,
    v.en_yakin_okul_m,
    v.en_yakin_saglik_m,

    ROUND(
  ST_Distance(m.geom::geography, p.geog)
) AS yeni_hizmet_m,

    CASE
      WHEN $4 = 'okul'
        THEN LEAST(v.en_yakin_okul_m,
          ROUND(ST_Distance(ST_PointOnSurface(m.geom)::geography, p.geog))::numeric)

      WHEN $4 = 'park'
        THEN LEAST(v.en_yakin_park_m,
          ROUND(ST_Distance(ST_PointOnSurface(m.geom)::geography, p.geog))::numeric)

      WHEN $4 = 'saglik'
        THEN LEAST(v.en_yakin_saglik_m,
          ROUND(ST_Distance(ST_PointOnSurface(m.geom)::geography, p.geog))::numeric)

      ELSE v.en_yakin_okul_m
    END AS sonra_hizmet_m

  FROM mahalle_analiz_view v
  JOIN mahalleler_clean m ON m.ad = v.ad
  CROSS JOIN p
  WHERE ST_DWithin(m.geom::geography, p.geog, $3)
),

skorlar AS (
  SELECT
    d.*,

    /* ----------- GENEL SKOR ÖNCE ----------- */

    ROUND(((

      $5 * ((d.nufus_yogunlugu_km2 - n.min_ny)
        / NULLIF((n.max_ny - n.min_ny), 0))

      +

      $6 * (
        (GREATEST(LEAST(d.en_yakin_park_m, n.max_park), n.min_park)
          - n.min_park)
        / NULLIF((n.max_park - n.min_park), 0)
      )

      +

      $7 * (
        (GREATEST(LEAST(d.en_yakin_okul_m, n.max_okul), n.min_okul)
          - n.min_okul)
        / NULLIF((n.max_okul - n.min_okul), 0)
      )

      +

      $8 * (
        (GREATEST(LEAST(d.en_yakin_saglik_m, n.max_saglik), n.min_saglik)
          - n.min_saglik)
        / NULLIF((n.max_saglik - n.min_saglik), 0)
      )

    ) * 100)::numeric, 2) AS skor_once,


    /* ----------- GENEL SKOR SONRA ----------- */

    ROUND(((

      $5 * ((d.nufus_yogunlugu_km2 - n.min_ny)
        / NULLIF((n.max_ny - n.min_ny), 0))

      +

      $6 * (
        CASE WHEN $4 = 'park'
          THEN (
            (GREATEST(LEAST(d.sonra_hizmet_m, n.max_park), n.min_park)
              - n.min_park)
            / NULLIF((n.max_park - n.min_park), 0)
          )
          ELSE (
            (GREATEST(LEAST(d.en_yakin_park_m, n.max_park), n.min_park)
              - n.min_park)
            / NULLIF((n.max_park - n.min_park), 0)
          )
        END
      )

      +

      $7 * (
        CASE WHEN $4 = 'okul'
          THEN (
            (GREATEST(LEAST(d.sonra_hizmet_m, n.max_okul), n.min_okul)
              - n.min_okul)
            / NULLIF((n.max_okul - n.min_okul), 0)
          )
          ELSE (
            (GREATEST(LEAST(d.en_yakin_okul_m, n.max_okul), n.min_okul)
              - n.min_okul)
            / NULLIF((n.max_okul - n.min_okul), 0)
          )
        END
      )

      +

      $8 * (
        CASE WHEN $4 = 'saglik'
          THEN (
            (GREATEST(LEAST(d.sonra_hizmet_m, n.max_saglik), n.min_saglik)
              - n.min_saglik)
            / NULLIF((n.max_saglik - n.min_saglik), 0)
          )
          ELSE (
            (GREATEST(LEAST(d.en_yakin_saglik_m, n.max_saglik), n.min_saglik)
              - n.min_saglik)
            / NULLIF((n.max_saglik - n.min_saglik), 0)
          )
        END
      )

    ) * 100)::numeric, 2) AS skor_sonra,


    /* ----------- TÜRE ÖZEL SKORLAR ----------- */

    ROUND((
      CASE
        WHEN $4 = 'park'
          THEN (
            (GREATEST(LEAST(d.en_yakin_park_m, n.max_park), n.min_park)
              - n.min_park)
            / NULLIF((n.max_park - n.min_park), 0)
          ) * 100

        WHEN $4 = 'okul'
          THEN (
            (GREATEST(LEAST(d.en_yakin_okul_m, n.max_okul), n.min_okul)
              - n.min_okul)
            / NULLIF((n.max_okul - n.min_okul), 0)
          ) * 100

        WHEN $4 = 'saglik'
          THEN (
            (GREATEST(LEAST(d.en_yakin_saglik_m, n.max_saglik), n.min_saglik)
              - n.min_saglik)
            / NULLIF((n.max_saglik - n.min_saglik), 0)
          ) * 100
      END
    )::numeric, 2) AS skor_once_tur,


    ROUND((
      CASE
        WHEN $4 = 'park'
          THEN (
            (GREATEST(LEAST(d.sonra_hizmet_m, n.max_park), n.min_park)
              - n.min_park)
            / NULLIF((n.max_park - n.min_park), 0)
          ) * 100

        WHEN $4 = 'okul'
          THEN (
            (GREATEST(LEAST(d.sonra_hizmet_m, n.max_okul), n.min_okul)
              - n.min_okul)
            / NULLIF((n.max_okul - n.min_okul), 0)
          ) * 100

        WHEN $4 = 'saglik'
          THEN (
            (GREATEST(LEAST(d.sonra_hizmet_m, n.max_saglik), n.min_saglik)
              - n.min_saglik)
            / NULLIF((n.max_saglik - n.min_saglik), 0)
          ) * 100
      END
    )::numeric, 2) AS skor_sonra_tur

  FROM d
  CROSS JOIN n
)

SELECT
  ad,
  yeni_hizmet_m,
  skor_once,
  skor_sonra,
  skor_once_tur,
  skor_sonra_tur,
  ROUND((skor_once - skor_sonra)::numeric, 2) AS iyilesme_puani
FROM skorlar
ORDER BY iyilesme_puani DESC;
`;

    // ✅ Artık 8 parametre gönderiyoruz
    const params = [lon, lat, radius, hizmetTur, w_ny, w_park, w_okul, w_saglik];
    const { rows } = await pool.query(sql, params);

    return res.json({
      input: { lon, lat, radius_m: radius, tur: hizmetTur, mode: mapMode },
      weights: { w_ny, w_park, w_okul, w_saglik },
      etkilenen_mahalle_sayisi: rows.length,
      top10: rows.slice(0, 10),
      detay: rows,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "simulasyon hata", detail: err.message });
  }
});

export default router;