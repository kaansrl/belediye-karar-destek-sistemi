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
      WITH n AS (SELECT * FROM norm_params)
      SELECT
        m.ad,
        ROUND((
          $1 * ((v.nufus_yogunlugu_km2 - n.min_ny) / NULLIF((n.max_ny - n.min_ny), 0)) +
          $2 * (
  (GREATEST(LEAST(v.en_yakin_park_m, n.max_park), n.min_park) - n.min_park)
  / NULLIF((n.max_park - n.min_park), 0)
) +

$3 * (
  (GREATEST(LEAST(v.en_yakin_okul_m, n.max_okul), n.min_okul) - n.min_okul)
  / NULLIF((n.max_okul - n.min_okul), 0)
) +

$4 * (
  (GREATEST(LEAST(v.en_yakin_saglik_m, n.max_saglik), n.min_saglik) - n.min_saglik)
  / NULLIF((n.max_saglik - n.min_saglik), 0)
)
        )::numeric * 100, 2) AS skor,
        ST_AsGeoJSON(m.geom)::json AS geometry
      FROM mahalleler_clean m
      JOIN mahalle_analiz_view v ON v.ad = m.ad
      CROSS JOIN n
      WHERE m.geom IS NOT NULL
      ORDER BY m.ad;
    `;

    const { rows } = await pool.query(q, [w_ny, w_park, w_okul, w_saglik]);

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