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
    console.log("SIM BODY:", req.body);

    const { lon, lat, radius_m, tur, mode, alt_tur } = req.body;
    const hizmetAltTur = typeof alt_tur === "string" ? alt_tur.trim().toLowerCase() : null;

    console.log("ALT TUR:", alt_tur, "->", hizmetAltTur);
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
alt_norm AS (
  SELECT
    MIN(alt_mesafe)::numeric AS min_alt_mesafe,
    MAX(alt_mesafe)::numeric AS max_alt_mesafe
  FROM (
    SELECT
      m.ad,
      CASE
        WHEN $4 = 'okul' AND NULLIF($9, '') IS NOT NULL THEN (
          SELECT MIN(
            ST_Distance(
              ST_PointOnSurface(m.geom)::geography,
              h.geom::geography
            )
          )
          FROM hizmet_noktalari h
          WHERE h.tur = 'okul'
            AND h.alt_tur = $9
        )

        WHEN $4 = 'saglik' AND NULLIF($9, '') IS NOT NULL THEN (
          SELECT MIN(
            ST_Distance(
              ST_PointOnSurface(m.geom)::geography,
              h.geom::geography
            )
          )
          FROM hizmet_noktalari h
          WHERE h.tur = 'saglik'
            AND h.alt_tur = $9
        )

        ELSE NULL
      END AS alt_mesafe
    FROM mahalleler_clean m
    WHERE m.geom IS NOT NULL
  ) t
  WHERE alt_mesafe IS NOT NULL
),                                  
ah AS (
  SELECT COALESCE((
    SELECT agirlik
    FROM hizmet_agirliklari
    WHERE tur = $4
      AND alt_tur = $9
    LIMIT 1
  ), 1.0) AS yeni_agirlik
),

d AS (
  SELECT
    v.ad,
    v.nufus_yogunlugu_km2,
    v.en_yakin_park_m,

    CASE
      WHEN $4 = 'okul' AND NULLIF($9, '') IS NOT NULL THEN (
        SELECT MIN(
          ST_Distance(
            ST_PointOnSurface(m.geom)::geography,
            h.geom::geography
          )
        )
        FROM hizmet_noktalari h
        WHERE h.tur = 'okul'
          AND h.alt_tur = $9
      )
      ELSE v.en_yakin_okul_m
    END AS en_yakin_okul_m,

    CASE
  WHEN $4 = 'saglik' AND NULLIF($9, '') IS NOT NULL THEN (
    SELECT MIN(
      ST_Distance(
        ST_PointOnSurface(m.geom)::geography,
        h.geom::geography
      )
    )
    FROM hizmet_noktalari h
    WHERE h.tur = 'saglik'
      AND h.alt_tur = $9
  )
  ELSE v.en_yakin_saglik_m
END AS en_yakin_saglik_m,

    ROUND(
      ST_Distance(ST_PointOnSurface(m.geom)::geography, p.geog)
    ) AS yeni_hizmet_m,

    CASE
      WHEN $4 = 'okul'
        THEN LEAST(
          CASE
            WHEN $4 = 'okul' AND NULLIF($9, '') IS NOT NULL THEN (
              SELECT MIN(
                ST_Distance(
                  ST_PointOnSurface(m.geom)::geography,
                  h.geom::geography
                )
              )
              FROM hizmet_noktalari h
              WHERE h.tur = 'okul'
                AND h.alt_tur = $9
            )
            ELSE v.en_yakin_okul_m
          END,
          ROUND(
            (
              ST_Distance(ST_PointOnSurface(m.geom)::geography, p.geog)
              / NULLIF(ah.yeni_agirlik, 0)
            )::numeric
          )
        )

      WHEN $4 = 'park'
        THEN LEAST(
          v.en_yakin_park_m,
          ROUND(ST_Distance(ST_PointOnSurface(m.geom)::geography, p.geog))::numeric
        )

      WHEN $4 = 'saglik'
  THEN LEAST(
    CASE
      WHEN $4 = 'saglik' AND NULLIF($9, '') IS NOT NULL THEN (
        SELECT MIN(
          ST_Distance(
            ST_PointOnSurface(m.geom)::geography,
            h.geom::geography
          )
        )
        FROM hizmet_noktalari h
        WHERE h.tur = 'saglik'
          AND h.alt_tur = $9
      )
      ELSE v.en_yakin_saglik_m
    END,
    ROUND(
      (
        ST_Distance(ST_PointOnSurface(m.geom)::geography, p.geog)
        / NULLIF(ah.yeni_agirlik, 0)
      )::numeric
    )
  )

      ELSE v.en_yakin_okul_m
    END AS sonra_hizmet_m

  FROM mahalle_analiz_view v
  JOIN mahalleler_clean m ON m.ad = v.ad
  CROSS JOIN p
  CROSS JOIN ah
  WHERE ST_DWithin(m.geom::geography, p.geog, $3)
),

skorlar AS (
  SELECT
    d.*,

    /* ----------- GENEL SKOR ÖNCE ----------- */

   fn_mahalle_skor_hesapla(
  d.nufus_yogunlugu_km2::numeric,
  d.en_yakin_park_m::numeric,
  d.en_yakin_okul_m::numeric,
  d.en_yakin_saglik_m::numeric,
  $5::numeric,
  $6::numeric,
  $7::numeric,
  $8::numeric
) AS skor_once,


    /* ----------- GENEL SKOR SONRA ----------- */

fn_mahalle_skor_hesapla(
  d.nufus_yogunlugu_km2::numeric,

  CASE
    WHEN $4 = 'park' THEN d.sonra_hizmet_m::numeric
    ELSE d.en_yakin_park_m::numeric
  END,

  CASE
    WHEN $4 = 'okul' THEN d.sonra_hizmet_m::numeric
    ELSE d.en_yakin_okul_m::numeric
  END,

  CASE
    WHEN $4 = 'saglik' THEN d.sonra_hizmet_m::numeric
    ELSE d.en_yakin_saglik_m::numeric
  END,

  $5::numeric,
  $6::numeric,
  $7::numeric,
  $8::numeric
) AS skor_sonra,



    /* ----------- TÜRE ÖZEL SKORLAR ----------- */

    ROUND((
  CASE
    WHEN $4 = 'park'
      THEN (
        (GREATEST(LEAST(d.en_yakin_park_m, n.max_park), n.min_park)
          - n.min_park)
        / NULLIF((n.max_park - n.min_park), 0)
      ) * 100

    WHEN $4 = 'okul' AND NULLIF($9, '') IS NOT NULL
      THEN (
        (GREATEST(LEAST(d.en_yakin_okul_m, alt_norm.max_alt_mesafe), alt_norm.min_alt_mesafe)
          - alt_norm.min_alt_mesafe)
        / NULLIF((alt_norm.max_alt_mesafe - alt_norm.min_alt_mesafe), 0)
      ) * 100

    WHEN $4 = 'okul'
      THEN (
        (GREATEST(LEAST(d.en_yakin_okul_m, n.max_okul), n.min_okul)
          - n.min_okul)
        / NULLIF((n.max_okul - n.min_okul), 0)
      ) * 100

    WHEN $4 = 'saglik' AND NULLIF($9, '') IS NOT NULL
      THEN (
        (GREATEST(LEAST(d.en_yakin_saglik_m, alt_norm.max_alt_mesafe), alt_norm.min_alt_mesafe)
          - alt_norm.min_alt_mesafe)
        / NULLIF((alt_norm.max_alt_mesafe - alt_norm.min_alt_mesafe), 0)
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

    WHEN $4 = 'okul' AND NULLIF($9, '') IS NOT NULL
      THEN (
        (GREATEST(LEAST(d.sonra_hizmet_m, alt_norm.max_alt_mesafe), alt_norm.min_alt_mesafe)
          - alt_norm.min_alt_mesafe)
        / NULLIF((alt_norm.max_alt_mesafe - alt_norm.min_alt_mesafe), 0)
      ) * 100

    WHEN $4 = 'okul'
      THEN (
        (GREATEST(LEAST(d.sonra_hizmet_m, n.max_okul), n.min_okul)
          - n.min_okul)
        / NULLIF((n.max_okul - n.min_okul), 0)
      ) * 100

    WHEN $4 = 'saglik' AND NULLIF($9, '') IS NOT NULL
      THEN (
        (GREATEST(LEAST(d.sonra_hizmet_m, alt_norm.max_alt_mesafe), alt_norm.min_alt_mesafe)
          - alt_norm.min_alt_mesafe)
        / NULLIF((alt_norm.max_alt_mesafe - alt_norm.min_alt_mesafe), 0)
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
CROSS JOIN alt_norm
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
    const params = [
  lon,
  lat,
  radius,
  hizmetTur,
  w_ny,
  w_park,
  w_okul,
  w_saglik,
  hizmetAltTur
];
    const { rows } = await pool.query(sql, params);

    return res.json({
      input: { lon, lat, radius_m: radius, tur: hizmetTur, mode: mapMode, alt_tur: hizmetAltTur },
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