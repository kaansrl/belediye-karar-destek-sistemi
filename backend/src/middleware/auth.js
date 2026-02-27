import jwt from "jsonwebtoken";

export function requireAuth(req, res, next) {
  const header = req.headers.authorization || "";
  const [type, token] = header.split(" ");

  if (type !== "Bearer" || !token) {
    return res.status(401).json({ error: "unauthorized" });
  }

  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET);
    next();
  } catch {
    return res.status(401).json({ error: "invalid_token" });
  }
}

export function requireRole(...allowed) {
  return (req, res, next) => {
    const role = req.user?.role;
    if (!role) return res.status(401).json({ error: "unauthorized" });
    if (!allowed.includes(role)) return res.status(403).json({ error: "forbidden" });
    next();
  };
}

