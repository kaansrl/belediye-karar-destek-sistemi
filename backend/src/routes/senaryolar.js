import express from "express";
import pool from "../db.js";
import { requireAuth } from "../middleware/auth.js";

const router = express.Router();

const toInt = (x) => {
  const n = Number(x);
  return Number.isFinite(n) ? Math.trunc(n) : null;
};

const getUserId = (req) => {
  // requireAuth'in set ettiği yapıya göre ikisini de destekleyelim
  const v = req.user?.id ?? req.user?.sub;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

// ✅ GET /api/senaryolar  -> liste
router.get("/", requireAuth, async (req, res) => {
  const userId = getUserId(req);
  if (!userId) return res.status(401).json({ error: "unauthorized_userid" });

  try {
    const r = await pool.query(
      `
      SELECT id, name, tur, mode, radius_m, lat, lon, created_at
      FROM senaryolar
      WHERE user_id = $1
      ORDER BY created_at DESC
      `,
      [userId]
    );

    res.json({ scenarios: r.rows });
  } catch (e) {
    console.error("GET /api/senaryolar hata:", e);
    res.status(500).json({ error: "server_error" });
  }
});

// ✅ POST /api/senaryolar  -> kaydet
router.post("/", requireAuth, async (req, res) => {
  const userId = getUserId(req);
  if (!userId) return res.status(401).json({ error: "unauthorized_userid" });

  try {
    const name = String(req.body?.name ?? "").trim();
    const lon = Number(req.body?.lon);
    const lat = Number(req.body?.lat);
    const radius_m = toInt(req.body?.radius_m);
    const tur = String(req.body?.tur ?? "").trim();
    const mode = String(req.body?.mode ?? "").trim();

    const weights = req.body?.weights ?? null; // JSONB
    const result_summary = req.body?.result_summary ?? null; // JSONB

    if (!name) return res.status(400).json({ error: "name gerekli" });
    if (!Number.isFinite(lon) || !Number.isFinite(lat))
      return res.status(400).json({ error: "lat/lon gerekli" });
    if (!radius_m) return res.status(400).json({ error: "radius_m gerekli" });
    if (!tur) return res.status(400).json({ error: "tur gerekli" });
    if (!mode) return res.status(400).json({ error: "mode gerekli" });

    const r = await pool.query(
      `
      INSERT INTO senaryolar
        (user_id, name, lon, lat, radius_m, tur, mode, weights, result_summary)
      VALUES
        ($1,$2,$3,$4,$5,$6,$7,$8::jsonb,$9::jsonb)
      RETURNING id, user_id, name, lon, lat, radius_m, tur, mode, created_at
      `,
      [userId, name, lon, lat, radius_m, tur, mode, weights, result_summary]
    );

    res.status(201).json({ scenario: r.rows[0] });
  } catch (e) {
    console.error("POST /api/senaryolar hata:", e);
    res.status(500).json({ error: "server_error" });
  }
});

// ✅ GET /api/senaryolar/:id  -> detay
router.get("/:id", requireAuth, async (req, res) => {
  const userId = getUserId(req);
  if (!userId) return res.status(401).json({ error: "unauthorized_userid" });

  const id = toInt(req.params.id);
  if (!id) return res.status(400).json({ error: "invalid_id" });

  try {
    const r = await pool.query(
      `
      SELECT *
      FROM senaryolar
      WHERE id = $1 AND user_id = $2
      `,
      [id, userId]
    );

    if (r.rowCount === 0) return res.status(404).json({ error: "not_found" });

    res.json({ scenario: r.rows[0] });
  } catch (e) {
    console.error("GET /api/senaryolar/:id hata:", e);
    res.status(500).json({ error: "server_error" });
  }
});

// ✅ PATCH /api/senaryolar/:id  -> isim değiştir
router.patch("/:id", requireAuth, async (req, res) => {
  const userId = getUserId(req);
  if (!userId) return res.status(401).json({ error: "unauthorized_userid" });

  const id = toInt(req.params.id);
  if (!id) return res.status(400).json({ error: "invalid_id" });

  const name = String(req.body?.name ?? "").trim();
  if (!name) return res.status(400).json({ error: "name gerekli" });

  try {
    const r = await pool.query(
      `
      UPDATE senaryolar
      SET name = $1
      WHERE id = $2 AND user_id = $3
      RETURNING id, user_id, name, lon, lat, radius_m, tur, mode, created_at
      `,
      [name, id, userId]
    );

    if (r.rowCount === 0) return res.status(404).json({ error: "not_found" });

    res.json({ scenario: r.rows[0] });
  } catch (e) {
    console.error("PATCH /api/senaryolar/:id hata:", e);
    res.status(500).json({ error: "server_error" });
  }
});

// ✅ DELETE /api/senaryolar/:id  -> sil
router.delete("/:id", requireAuth, async (req, res) => {
  const userId = getUserId(req);
  if (!userId) return res.status(401).json({ error: "unauthorized_userid" });

  const id = toInt(req.params.id);
  if (!id) return res.status(400).json({ error: "invalid_id" });

  try {
    const r = await pool.query(
      `
      DELETE FROM senaryolar
      WHERE id = $1 AND user_id = $2
      RETURNING id
      `,
      [id, userId]
    );

    if (r.rowCount === 0) return res.status(404).json({ error: "not_found" });

    // 204 de olur ama frontend rahat etsin diye JSON dönelim
    res.json({ ok: true, id: r.rows[0].id });
  } catch (e) {
    console.error("DELETE /api/senaryolar/:id hata:", e);
    res.status(500).json({ error: "server_error" });
  }
});

// ✅ POST /api/senaryolar/compare  -> karşılaştır
router.post("/compare", requireAuth, async (req, res) => {
  const userId = getUserId(req);
  if (!userId) return res.status(401).json({ error: "unauthorized_userid" });

  try {
        // ✅ N'li compare isteği geldiyse (scenario_ids)
    const scenario_ids_raw = req.body?.scenario_ids;

    if (Array.isArray(scenario_ids_raw)) {
      const scenario_ids = scenario_ids_raw
        .map(toInt)
        .filter((x) => Number.isFinite(x) && x > 0);

      if (scenario_ids.length < 2) {
        return res.status(400).json({ error: "scenario_ids en az 2 eleman olmalı" });
      }

      const baseline_id = toInt(req.body?.baseline_id) ?? scenario_ids[0];
      if (!baseline_id) {
        return res.status(400).json({ error: "baseline_id geçersiz" });
      }
      if (!scenario_ids.includes(baseline_id)) {
        return res.status(400).json({ error: "baseline_id scenario_ids içinde olmalı" });
      }

      // 🔐 sahiplik kontrolü
      const own = await pool.query(
        `
        SELECT id, user_id
        FROM senaryolar
        WHERE id = ANY($1::int[])
        `,
        [scenario_ids]
      );

      if (own.rowCount !== scenario_ids.length) {
        return res.status(404).json({ error: "Senaryolardan biri bulunamadı" });
      }
      const invalid = own.rows.find((r) => Number(r.user_id) !== userId);
      if (invalid) {
        return res.status(403).json({ error: "Bu senaryolara erişim yetkin yok" });
      }

    // ✅ Baseline + N senaryo için "çoklu fark matrisi" + leaderboard
const sql = `
WITH selected AS (
  SELECT id, name, result_summary
  FROM senaryolar
  WHERE id = ANY($1::int[])
),

s_rows AS (
  SELECT
    s.id AS scenario_id,
    s.name AS scenario_name,
    (x->>'ad') AS ad,
    COALESCE((x->>'iyilesme_puani')::numeric, 0) AS iyilesme,
    (x->>'skor_once')::numeric AS skor_once,
    (x->>'skor_sonra')::numeric AS skor_sonra
  FROM selected s
  LEFT JOIN LATERAL jsonb_array_elements(s.result_summary->'top10') x ON TRUE
),

base AS (
  SELECT
    ad,
    MAX(iyilesme) AS base_iyilesme,
    MAX(skor_once) AS base_skor_once,
    MAX(skor_sonra) AS base_skor_sonra
  FROM s_rows
  WHERE scenario_id = $2
  GROUP BY ad
),

all_mahalle AS (
  SELECT DISTINCT ad
  FROM s_rows
  WHERE ad IS NOT NULL
),

matrix_rows AS (
  SELECT
    m.ad AS mahalle_ad,
    b.base_iyilesme,
    b.base_skor_once,
    b.base_skor_sonra,
    (
      SELECT COALESCE(
        jsonb_agg(
          jsonb_build_object(
            'id', r.scenario_id,
            'name', r.scenario_name,
            'iyilesme', r.iyilesme,
            'skor_once', r.skor_once,
            'skor_sonra', r.skor_sonra,
            'deltaIyilesme', (r.iyilesme - COALESCE(b.base_iyilesme, 0)),
            'deltaSkorSonra', (r.skor_sonra - b.base_skor_sonra)
          )
        ),
        '[]'::jsonb
      )
      FROM s_rows r
      WHERE r.ad = m.ad
    ) AS items
  FROM all_mahalle m
  LEFT JOIN base b ON b.ad = m.ad
),

leaderboard AS (
  SELECT
    s.id,
    s.name,
    (s.result_summary->>'etkilenen_mahalle_sayisi')::int AS etkilenen,
    COALESCE((
      SELECT SUM(r.iyilesme)
      FROM s_rows r
      WHERE r.scenario_id = s.id
    ), 0) AS toplamIyilesmeTop10
  FROM selected s
  ORDER BY toplamIyilesmeTop10 DESC
)

SELECT jsonb_build_object(
  'baseline', (
    SELECT jsonb_build_object(
      'id', s.id,
      'name', s.name,
      'etkilenen', (s.result_summary->>'etkilenen_mahalle_sayisi')::int,
      'toplamIyilesmeTop10', COALESCE((SELECT SUM(iyilesme) FROM s_rows WHERE scenario_id = s.id), 0)
    )
    FROM selected s
    WHERE s.id = $2
  ),
  'leaderboard', (SELECT COALESCE(jsonb_agg(to_jsonb(leaderboard)), '[]'::jsonb) FROM leaderboard),
  'matrix', (
    SELECT COALESCE(
      jsonb_agg(
        jsonb_build_object(
          'mahalle_ad', mahalle_ad,
          'baseline', jsonb_build_object(
            'iyilesme', base_iyilesme,
            'skor_once', base_skor_once,
            'skor_sonra', base_skor_sonra
          ),
          'items', items
        )
        ORDER BY mahalle_ad
      ),
      '[]'::jsonb
    )
    FROM matrix_rows
  )
) AS compare;
`;
      

      const r = await pool.query(sql, [scenario_ids, baseline_id]);
      return res.json(r.rows[0].compare);
    }

    const a_id = toInt(req.body?.a_id);
    const b_id = toInt(req.body?.b_id);

    if (!a_id || !b_id) {
      return res.status(400).json({ error: "a_id ve b_id gerekli" });
    }

    // 🔐 sahiplik kontrolü
    const ownershipCheck = await pool.query(
      `
      SELECT id, user_id
      FROM senaryolar
      WHERE id IN ($1, $2)
      `,
      [a_id, b_id]
    );

    if (ownershipCheck.rowCount !== 2) {
      return res.status(404).json({ error: "Senaryolardan biri bulunamadı" });
    }

    const invalid = ownershipCheck.rows.find((r) => Number(r.user_id) !== userId);
    if (invalid) {
      return res.status(403).json({ error: "Bu senaryolara erişim yetkin yok" });
    }

    const compareSql = `
      WITH a AS (
        SELECT id, name, result_summary
        FROM senaryolar
        WHERE id = $1
      ),
      b AS (
        SELECT id, name, result_summary
        FROM senaryolar
        WHERE id = $2
      ),
      a_rows AS (
        SELECT
          (x->>'ad') AS ad,
          (x->>'iyilesme_puani')::numeric AS iyilesme,
          (x->>'skor_once')::numeric AS skor_once,
          (x->>'skor_sonra')::numeric AS skor_sonra,
          (x->>'yeni_hizmet_m')::int AS yeni_hizmet_m
        FROM a
        CROSS JOIN LATERAL jsonb_array_elements(a.result_summary->'top10') x
      ),
      b_rows AS (
        SELECT
          (x->>'ad') AS ad,
          (x->>'iyilesme_puani')::numeric AS iyilesme,
          (x->>'skor_once')::numeric AS skor_once,
          (x->>'skor_sonra')::numeric AS skor_sonra,
          (x->>'yeni_hizmet_m')::int AS yeni_hizmet_m
        FROM b
        CROSS JOIN LATERAL jsonb_array_elements(b.result_summary->'top10') x
      ),
      ortak AS (
        SELECT
          a_rows.ad,
          a_rows.iyilesme AS a_iyilesme,
          b_rows.iyilesme AS b_iyilesme,
          (a_rows.iyilesme - b_rows.iyilesme) AS fark
        FROM a_rows
        JOIN b_rows USING (ad)
      ),
      sadece_a AS (
        SELECT a_rows.*
        FROM a_rows
        LEFT JOIN b_rows USING (ad)
        WHERE b_rows.ad IS NULL
      ),
      sadece_b AS (
        SELECT b_rows.*
        FROM b_rows
        LEFT JOIN a_rows USING (ad)
        WHERE a_rows.ad IS NULL
      )
      SELECT jsonb_build_object(
        'a', (SELECT jsonb_build_object(
            'id', a.id,
            'name', a.name,
            'input', a.result_summary->'input',
            'etkilenen', (a.result_summary->>'etkilenen_mahalle_sayisi')::int,
            'toplamIyilesmeTop10', (SELECT COALESCE(SUM(iyilesme),0) FROM a_rows)
        ) FROM a),
        'b', (SELECT jsonb_build_object(
            'id', b.id,
            'name', b.name,
            'input', b.result_summary->'input',
            'etkilenen', (b.result_summary->>'etkilenen_mahalle_sayisi')::int,
            'toplamIyilesmeTop10', (SELECT COALESCE(SUM(iyilesme),0) FROM b_rows)
        ) FROM b),
        'ortak', (SELECT COALESCE(jsonb_agg(to_jsonb(ortak) ORDER BY fark DESC), '[]'::jsonb) FROM ortak),
        'sadeceA', (SELECT COALESCE(jsonb_agg(to_jsonb(sadece_a) ORDER BY iyilesme DESC), '[]'::jsonb) FROM sadece_a),
        'sadeceB', (SELECT COALESCE(jsonb_agg(to_jsonb(sadece_b) ORDER BY iyilesme DESC), '[]'::jsonb) FROM sadece_b)
      ) AS compare;
    `;

    const result = await pool.query(compareSql, [a_id, b_id]);
    res.json(result.rows[0].compare);
  } catch (e) {
    console.error("POST /api/senaryolar/compare hata:", e);
    res.status(500).json({ error: "server_error" });
  }
});

export default router;