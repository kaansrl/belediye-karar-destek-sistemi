import express from "express";
import pool from "../db.js";

const router = express.Router();

const allowedTur = new Set(["okul", "park", "saglik"]);

const pickTur = (x) => {
  const t = typeof x === "string" ? x.trim().toLowerCase() : "okul";
  return allowedTur.has(t) ? t : "okul";
};

/**
 * GET /api/mahalleler/geojson
 *   - mode=genel (default): birleşik MCDA skor
 *   - mode=tur&tur=okul|park|saglik: seçili tür skoru (tek metrik)
 */
router.get("/geojson", async (req, res) => {
  try {
    const mode = (req.query.mode || "genel").toString().trim().toLowerCase();
    const tur = pickTur(req.query.tur);
    const altTur =
  typeof req.query.alt_tur === "string"
    ? req.query.alt_tur.trim().toLowerCase()
    : "";

    // Varsayılan ağırlıklar (genel mod)
    let w_ny = 0.35;
    let w_park = 0.20;
    let w_okul = 0.25;
    let w_saglik = 0.20;

    // Seçili tür modu: sadece o hizmet aktif
    if (mode === "tur") {
      w_ny = 0;
      w_park = tur === "park" ? 1 : 0;
      w_okul = tur === "okul" ? 1 : 0;
      w_saglik = tur === "saglik" ? 1 : 0;
    }
    
    const q = `
WITH alt_norm AS (
  SELECT
    MIN(alt_mesafe)::numeric AS min_alt_mesafe,
    MAX(alt_mesafe)::numeric AS max_alt_mesafe
  FROM (
    SELECT
      m.ad,
      (
        SELECT MIN(
          ST_Distance(
            ST_PointOnSurface(m.geom)::geography,
            h.geom::geography
          )
        )
        FROM hizmet_noktalari h
        WHERE h.tur = $5::text
          AND NULLIF($6::text, '') IS NOT NULL
          AND h.alt_tur = $6::text
      ) AS alt_mesafe
    FROM mahalleler_clean m
    WHERE m.geom IS NOT NULL
  ) t
  WHERE alt_mesafe IS NOT NULL
)

SELECT
  m.ad,

  CASE
    WHEN $5::text = 'okul' AND NULLIF($6::text, '') IS NOT NULL THEN
      fn_mesafe_skor_hesapla(
        COALESCE(
          (
            SELECT MIN(
              ST_Distance(
                ST_PointOnSurface(m.geom)::geography,
                h.geom::geography
              )
            )
            FROM hizmet_noktalari h
            WHERE h.tur = 'okul'
              AND h.alt_tur = $6::text
          )::numeric,
          v.en_yakin_okul_m::numeric
        ),
        alt_norm.min_alt_mesafe,
        alt_norm.max_alt_mesafe
      )

    WHEN $5::text = 'saglik' AND NULLIF($6::text, '') IS NOT NULL THEN
      fn_mesafe_skor_hesapla(
        (
          v.en_yakin_saglik_m::numeric /
          COALESCE(
            (
              SELECT ha.agirlik
              FROM hizmet_agirliklari ha
              WHERE ha.tur = 'saglik'
                AND ha.alt_tur = $6::text
              LIMIT 1
            ),
            1.0
          )
        ),
        alt_norm.min_alt_mesafe,
        alt_norm.max_alt_mesafe
      )

    ELSE
      fn_mahalle_skor_hesapla(
        v.nufus_yogunlugu_km2::numeric,
        v.en_yakin_park_m::numeric,
        v.en_yakin_okul_m::numeric,
        CASE
          WHEN $5::text = 'saglik' AND NULLIF($6::text, '') IS NOT NULL THEN
            (
              v.en_yakin_saglik_m::numeric /
              COALESCE(
                (
                  SELECT ha.agirlik
                  FROM hizmet_agirliklari ha
                  WHERE ha.tur = 'saglik'
                    AND ha.alt_tur = $6::text
                  LIMIT 1
                ),
                1.0
              )
            )
          ELSE
            v.en_yakin_saglik_m::numeric
        END,
        $1::numeric,
        $2::numeric,
        $3::numeric,
        $4::numeric
      )
  END AS skor,

  ST_AsGeoJSON(m.geom)::json AS geometry

FROM mahalleler_clean m
JOIN mahalle_analiz_view v ON v.ad = m.ad
CROSS JOIN alt_norm
WHERE m.geom IS NOT NULL
ORDER BY m.ad;
`;

    const { rows } = await pool.query(q, [w_ny, w_park, w_okul, w_saglik, tur, altTur]);

    const fc = {
      type: "FeatureCollection",
      features: rows.map((r) => ({
        type: "Feature",
        properties: {
          ad: r.ad,
          skor: Number(r.skor ?? 0),
        },
        geometry: r.geometry,
      })),
    };

    return res.json({
      meta: { mode, tur, count: rows.length, weights: { w_ny, w_park, w_okul, w_saglik } },
      ...fc,
    });
  } catch (err) {
    console.error("mahalle geojson hata:", err);
    return res.status(500).json({
      error: "mahalle geojson hata",
      detail: err.message,
    });
  }
});

export default router;