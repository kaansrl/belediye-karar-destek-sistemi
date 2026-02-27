import express from "express";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import pool from "../db.js";
import { requireAuth, requireRole } from "../middleware/auth.js";

const router = express.Router();

router.post("/login", async (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) return res.status(400).json({ error: "email_password_required" });

  const q = await pool.query(
    "SELECT id,email,password_hash,role,is_active FROM users WHERE email=$1",
    [email.trim().toLowerCase()]
  );

  const u = q.rows[0];

if (!u) {
  return res.status(401).json({ error: "invalid_credentials" });
}

if (!u.is_active) {
  return res.status(403).json({ error: "user_inactive" });
}

const ok = await bcrypt.compare(password, u.password_hash);
if (!ok) {
  return res.status(401).json({ error: "invalid_credentials" });
}

  await pool.query(
  "UPDATE users SET last_login_at = NOW() WHERE id = $1",
  [u.id]
);

  const token = jwt.sign(
    { sub: u.id, role: u.role, email: u.email },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || "7d" }
  );

  return res.json({ token, user: { id: u.id, email: u.email, role: u.role } });
});

router.get("/me", requireAuth, async (req, res) => {
  const q = await pool.query(
    "SELECT id, email, role, name, last_login_at FROM users WHERE id = $1",
    [req.user.sub]
  );

  return res.json(q.rows[0]);
});
// ✅ Admin: kullanıcıları listele
router.get("/users", requireAuth, requireRole("admin"), async (req, res) => {
  const q = await pool.query(`
    SELECT id, email, role, is_active, last_login_at, created_at
    FROM users
    ORDER BY email;
  `);

  return res.json({ users: q.rows });
});


// ✅ admin: kullanıcı aktif/pasif
router.patch("/users/:id/active", requireAuth, requireRole("admin"), async (req, res) => {
  const id = Number(req.params.id);
  const { is_active } = req.body || {};

  if (!Number.isFinite(id)) return res.status(400).json({ error: "invalid_id" });
  if (typeof is_active !== "boolean") return res.status(400).json({ error: "is_active_boolean_required" });

  const q = await pool.query(
    `UPDATE users
     SET is_active = $2
     WHERE id = $1
     RETURNING id, email, role, is_active`,
    [id, is_active]
  );

  if (q.rowCount === 0) return res.status(404).json({ error: "not_found" });
  return res.json({ ok: true, user: q.rows[0] });
});


// ✅ Admin: kullanıcı oluştur
router.post("/users", requireAuth, requireRole("admin"), async (req, res) => {
  try {
    const { email, password, role } = req.body || {};

    if (!email || !password) {
      return res.status(400).json({ error: "email_password_required" });
    }

    const cleanEmail = email.trim().toLowerCase();
    const cleanRole = (role || "analyst").trim().toLowerCase();

    if (!["admin", "analyst", "viewer"].includes(cleanRole)) {
  return res.status(400).json({ error: "invalid_role" });
}

    const exists = await pool.query("SELECT 1 FROM users WHERE email=$1", [cleanEmail]);
    if (exists.rowCount > 0) {
      return res.status(400).json({ error: "email_already_exists" });
    }

    const hash = await bcrypt.hash(password, 10);

    const q = await pool.query(
      `INSERT INTO users (email, password_hash, role, is_active)
       VALUES ($1,$2,$3,true)
       RETURNING id, email, role, is_active, created_at`,
      [cleanEmail, hash, cleanRole]
    );

    return res.json({ ok: true, user: q.rows[0] });
  } catch (err) {
    console.error("create user error:", err);
    return res.status(500).json({ error: "server_error" });
  }
});

export default router;