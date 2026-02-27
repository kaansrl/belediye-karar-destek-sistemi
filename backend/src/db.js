import pkg from "pg";
const { Pool } = pkg;

const pool = new Pool({
  connectionString: process.env.DB_URL,
});

pool.on("connect", () => {
  console.log("PostgreSQL connected ✅");
});

pool.on("error", (err) => {
  console.error("PostgreSQL error ❌", err);
});

export default pool;
