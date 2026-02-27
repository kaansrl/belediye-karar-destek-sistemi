import express from "express";
import cors from "cors";

import simulasyonRoutes from "./routes/simulasyon.js";
import mahallelerRoutes from "./routes/mahalleler.js";
import onerilerRoutes from "./routes/oneriler.js";
import senaryolarRoutes from "./routes/senaryolar.js";

// ✅ YENİ: auth route
import authRoutes from "./routes/auth.js";

const app = express();

app.use(cors());
app.use(express.json());

// ✅ YENİ: auth route'u bağla
app.use("/api/auth", authRoutes);

// route'lar middleware'lerden sonra gelsin
app.use("/api/mahalleler", mahallelerRoutes);
app.use("/api/simulasyon", simulasyonRoutes);
app.use("/api/oneriler", onerilerRoutes);
app.use("/api/senaryolar", senaryolarRoutes);
app.get("/api/hello", (req, res) => {
  res.json({ message: "Hello from backend ✅" });
});

app.get("/api/health", (req, res) => {
  res.json({ ok: true, ts: new Date().toISOString() });
});

export default app;