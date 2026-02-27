import "dotenv/config";
import bcrypt from "bcrypt";
import pool from "../db.js";

const email = process.argv[2];
const password = process.argv[3];
const role = process.argv[4] || "analyst";

if (!email || !password) {
  console.log("Usage: node src/scripts/createUser.js mail pass role");
  process.exit(1);
}

const run = async () => {
  const hash = await bcrypt.hash(password, 10);

  await pool.query(
    `INSERT INTO users(email,password_hash,role)
     VALUES($1,$2,$3)
     ON CONFLICT (email)
     DO UPDATE SET password_hash=EXCLUDED.password_hash, role=EXCLUDED.role`,
    [email.trim().toLowerCase(), hash, role]
  );

  console.log("User hazır:", email, role);
  process.exit(0);
};

run().catch((e) => {
  console.error(e);
  process.exit(1);
});