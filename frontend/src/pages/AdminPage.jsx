import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { apiFetch, clearAuth } from "../lib/api";
import logo from "../assets/Yeşilyurt_Belediyesi_logo.svg.png";

const roleLabel = (role) => {
  switch (String(role || "").toLowerCase()) {
    case "admin":
      return "Yönetici";
    case "analyst":
      return "Analist";
    case "viewer":
      return "İzleyici";
    default:
      return role || "-";
  }
};

const fmtDateTR = (iso) => {
  if (!iso) return "-";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return String(iso);
  return d.toLocaleString("tr-TR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
};

export default function AdminPage() {
  const nav = useNavigate();

  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  // create user form
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState("analyst");
  const [creating, setCreating] = useState(false);

  // filter
  const [q, setQ] = useState("");

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return users;
    return users.filter((u) => String(u.email || "").toLowerCase().includes(s));
  }, [users, q]);

  const handle401 = () => {
    nav("/login", { replace: true });
  };

  const loadUsers = async () => {
    setErr("");
    setLoading(true);
    const { res, data } = await apiFetch("/api/auth/users");
    if (res.status === 401) return handle401();
    if (!res.ok) {
      setErr(data?.error || "users_fetch_failed");
      setLoading(false);
      return;
    }
    setUsers(Array.isArray(data?.users) ? data.users : []);
    setLoading(false);
  };

  useEffect(() => {
    loadUsers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const toggleActive = async (u) => {
    setErr("");
    const next = !u.is_active;

    // optimistic update
    setUsers((prev) => prev.map((x) => (x.id === u.id ? { ...x, is_active: next } : x)));

    const { res, data } = await apiFetch(`/api/auth/users/${u.id}/active`, {
      method: "PATCH",
      body: JSON.stringify({ is_active: next }),
    });

    if (res.status === 401) return handle401();
    if (!res.ok) {
      // rollback
      setUsers((prev) => prev.map((x) => (x.id === u.id ? { ...x, is_active: !next } : x)));
      setErr(data?.error || "toggle_failed");
      return;
    }

    const updated = data?.user;
    if (updated?.id) {
      setUsers((prev) => prev.map((x) => (x.id === updated.id ? { ...x, ...updated } : x)));
    }
  };

  const createUser = async () => {
    setErr("");
    if (!email.trim() || !password) {
      setErr("E-posta ve şifre zorunludur.");
      return;
    }
    setCreating(true);

    const { res, data } = await apiFetch("/api/auth/users", {
      method: "POST",
      body: JSON.stringify({ email, password, role }),
    });

    if (res.status === 401) return handle401();
    if (!res.ok) {
      // backend error'ları Türkçe göstermek istersen burada mapleyebiliriz
      setErr(data?.error || "create_failed");
      setCreating(false);
      return;
    }

    setEmail("");
    setPassword("");
    setRole("analyst");

    await loadUsers();
    setCreating(false);
  };

  const logout = () => {
    clearAuth();
    nav("/login", { replace: true });
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#f4f6f9",
        fontFamily: "system-ui, -apple-system, sans-serif",
      }}
    >
      {/* HEADER */}
      <div
        style={{
          background: "white",
          padding: "16px 28px",
          borderBottom: "1px solid #e5e7eb",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        {/* SOL: LOGO + BAŞLIK */}
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <img src={logo} alt="Yeşilyurt Belediyesi" style={{ height: 50 }} />
          <div>
            <div style={{ fontSize: 22, fontWeight: 800 }}>Yönetici Paneli</div>
            <div style={{ fontSize: 13, opacity: 0.65 }}>
              Kullanıcı yönetimi (listele / oluştur / aktif-pasif)
            </div>
          </div>
        </div>

        {/* SAĞ: BUTONLAR */}
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <Link
            to="/"
            style={{
              textDecoration: "none",
              padding: "8px 14px",
              borderRadius: 8,
              border: "1px solid #e5e7eb",
              background: "white",
              fontSize: 14,
              fontWeight: 700,
              color: "#111827",
            }}
          >
            ← Harita
          </Link>

          <button
            onClick={logout}
            style={{
              padding: "8px 14px",
              borderRadius: 8,
              border: "1px solid #e5e7eb",
              background: "white",
              cursor: "pointer",
              fontWeight: 700,
            }}
          >
            Çıkış
          </button>
        </div>
      </div>

      {/* İÇERİK */}
      <div style={{ padding: 28 }}>
        {/* create user */}
        <div
          style={{
            background: "white",
            borderRadius: 14,
            padding: 18,
            boxShadow: "0 4px 12px rgba(0,0,0,0.05)",
          }}
        >
          <div style={{ fontWeight: 900, marginBottom: 12, fontSize: 16 }}>
            Yeni Kullanıcı Oluştur
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 160px 140px", gap: 10 }}>
            <input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="e-posta"
              style={{ padding: "10px 12px", borderRadius: 10, border: "1px solid #d1d5db" }}
            />
            <input
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="şifre"
              type="password"
              style={{ padding: "10px 12px", borderRadius: 10, border: "1px solid #d1d5db" }}
            />
            <select
              value={role}
              onChange={(e) => setRole(e.target.value)}
              style={{ padding: "10px 12px", borderRadius: 10, border: "1px solid #d1d5db" }}
            >
              <option value="analyst">Analist</option>
              <option value="admin">Yönetici</option>
              <option value="viewer">İzleyici</option>
            </select>

            <button
              onClick={createUser}
              disabled={creating}
              style={{
                padding: "10px 12px",
                borderRadius: 10,
                border: "1px solid #d1d5db",
                background: "#111827",
                color: "white",
                cursor: creating ? "not-allowed" : "pointer",
                fontWeight: 900,
              }}
            >
              {creating ? "Oluşturuluyor..." : "Oluştur"}
            </button>
          </div>

          {err && <div style={{ marginTop: 12, color: "crimson", fontWeight: 600 }}>{err}</div>}
        </div>

        {/* users list */}
        <div
          style={{
            marginTop: 20,
            background: "white",
            borderRadius: 14,
            padding: 18,
            boxShadow: "0 4px 12px rgba(0,0,0,0.05)",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
            <div style={{ fontSize: 16, fontWeight: 900 }}>Kullanıcılar</div>
            <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="e-posta ara..."
                style={{ padding: "8px 10px", borderRadius: 10, border: "1px solid #d1d5db" }}
              />
              <button
                onClick={loadUsers}
                style={{
                  padding: "8px 12px",
                  borderRadius: 10,
                  border: "1px solid #d1d5db",
                  background: "white",
                  cursor: "pointer",
                  fontWeight: 800,
                }}
              >
                Yenile
              </button>
            </div>
          </div>

          {loading ? (
            <div style={{ marginTop: 12 }}>Yükleniyor...</div>
          ) : (
            <div style={{ marginTop: 12, overflowX: "auto" }}>
              <table cellPadding="10" style={{ borderCollapse: "collapse", minWidth: 900, width: "100%" }}>
                <thead>
                  <tr style={{ background: "#f3f4f6" }}>
                    <th align="left">E-posta</th>
                    <th>Rol</th>
                    <th>Durum</th>
                    <th>Son Giriş</th>
                    <th>Oluşturulma</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((u) => (
                    <tr key={u.id} style={{ borderTop: "1px solid #e5e7eb" }}>
                      <td>{u.email}</td>

                      <td style={{ textAlign: "center" }}>
                        <span
                          style={{
                            padding: "4px 10px",
                            borderRadius: 999,
                            border: "1px solid #e5e7eb",
                            background: "#fff",
                            fontWeight: 800,
                          }}
                        >
                          {roleLabel(u.role)}
                        </span>
                      </td>

                      <td style={{ textAlign: "center", fontWeight: 700 }}>
                        {u.is_active ? "Aktif ✅" : "Pasif ⛔"}
                      </td>

                      <td style={{ textAlign: "center", fontSize: 12, opacity: 0.85 }}>
                        {fmtDateTR(u.last_login_at)}
                      </td>

                      <td style={{ textAlign: "center", fontSize: 12, opacity: 0.85 }}>
                        {fmtDateTR(u.created_at)}
                      </td>

                      <td style={{ textAlign: "right" }}>
                        <button
                          onClick={() => toggleActive(u)}
                          style={{
                            padding: "7px 12px",
                            borderRadius: 10,
                            border: "1px solid #d1d5db",
                            background: "white",
                            cursor: "pointer",
                            fontWeight: 900,
                          }}
                        >
                          {u.is_active ? "Pasifleştir" : "Aktifleştir"}
                        </button>
                      </td>
                    </tr>
                  ))}

                  {filtered.length === 0 && (
                    <tr>
                      <td colSpan={6} style={{ padding: 14, opacity: 0.7 }}>
                        Sonuç yok.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}