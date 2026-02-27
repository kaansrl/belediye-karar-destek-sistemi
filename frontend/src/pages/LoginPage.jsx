import { useState } from "react";
import { useNavigate } from "react-router-dom";
import logo from "../assets/Yeşilyurt_Belediyesi_logo.svg.png";

function trError(code) {
  const map = {
    email_password_required: "E-posta ve şifre zorunlu.",
    invalid_credentials: "E-posta veya şifre hatalı.",
    user_inactive: "Hesabınız pasif. Yönetici ile iletişime geçin.",
    login_failed: "Giriş yapılamadı. Lütfen tekrar deneyin.",
    token_missing: "Oturum anahtarı alınamadı. Lütfen tekrar deneyin.",
    me_failed: "Oturum doğrulanamadı. Lütfen tekrar giriş yapın.",
    role_missing_from_me: "Kullanıcı rolü alınamadı. Lütfen tekrar giriş yapın.",
    network_error: "Sunucuya bağlanılamadı. Backend açık mı? (3001)",
    unauthorized: "Yetkisiz erişim. Lütfen tekrar giriş yapın.",
    invalid_token: "Oturum süresi dolmuş olabilir. Lütfen tekrar giriş yapın.",
    forbidden: "Bu işlem için yetkiniz yok.",
  };

  return map[code] || "Bir hata oluştu. Lütfen tekrar deneyin.";
}

export default function LoginPage() {
  const nav = useNavigate();

  const [email, setEmail] = useState("analyst@test.com");
  const [password, setPassword] = useState("123456");
  const [authErr, setAuthErr] = useState("");
  const [authLoading, setAuthLoading] = useState(false);

  const login = async () => {
    setAuthErr("");
    setAuthLoading(true);

    localStorage.removeItem("token");
    localStorage.removeItem("role");

    try {
      const res = await fetch("http://localhost:3001/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        setAuthErr(trError(data?.error || "login_failed"));
        return;
      }

      const token = data?.token;
      if (!token) {
        setAuthErr(trError("token_missing"));
        return;
      }

      localStorage.setItem("token", token);

      const meRes = await fetch("http://localhost:3001/api/auth/me", {
        headers: { Authorization: `Bearer ${token}` },
      });

      const me = await meRes.json().catch(() => ({}));

      if (!meRes.ok) {
        localStorage.removeItem("token");
        localStorage.removeItem("role");
        setAuthErr(trError(me?.error || "me_failed"));
        return;
      }

      const role = me?.role || me?.user?.role;
      if (!role) {
        localStorage.removeItem("token");
        localStorage.removeItem("role");
        setAuthErr(trError("role_missing_from_me"));
        return;
      }

      const allowed = role === "analyst" || role === "admin" || role === "viewer";
      if (!allowed) {
        localStorage.removeItem("token");
        localStorage.removeItem("role");
        setAuthErr("Bu kullanıcı için sisteme giriş yetkisi yok.");
        return;
      }

      localStorage.setItem("role", role);
      nav("/", { replace: true });
    } catch (e) {
      setAuthErr(trError("network_error"));
    } finally {
      setAuthLoading(false);
    }
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#f4f6f9",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
        fontFamily: "system-ui, -apple-system, sans-serif",
      }}
    >
      <div style={{ width: "100%", maxWidth: 520 }}>
        {/* Üst başlık */}
        <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 14 }}>
          <img src={logo} alt="Yeşilyurt Belediyesi" style={{ height: 52 }} />
          <div>
            <div style={{ fontSize: 22, fontWeight: 900, lineHeight: 1.2 }}>
              Mekansal Karar Destek Sistemi
            </div>
            <div style={{ fontSize: 13, opacity: 0.7 }}>
              Hizmet Önceliklendirme ve Yatırım Simülasyonu
            </div>
          </div>
        </div>

        {/* Kart */}
        <div
          style={{
            background: "white",
            borderRadius: 14,
            padding: 18,
            boxShadow: "0 8px 20px rgba(0,0,0,0.06)",
            border: "1px solid #e5e7eb",
          }}
        >
          <div style={{ fontSize: 18, fontWeight: 900, marginBottom: 6 }}>Giriş</div>
          <div style={{ opacity: 0.7, fontSize: 13, marginBottom: 14 }}>
            Kapalı sistem. Yalnızca yetkili kullanıcılar giriş yapabilir.
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="E-posta"
              autoComplete="username"
              style={{
                padding: "11px 12px",
                borderRadius: 10,
                border: "1px solid #d1d5db",
                outline: "none",
              }}
            />

            <input
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Şifre"
              type="password"
              autoComplete="current-password"
              style={{
                padding: "11px 12px",
                borderRadius: 10,
                border: "1px solid #d1d5db",
                outline: "none",
              }}
            />

            <button
              onClick={login}
              disabled={authLoading}
              style={{
                padding: "11px 12px",
                borderRadius: 10,
                border: "1px solid #111827",
                background: "#111827",
                color: "white",
                cursor: authLoading ? "not-allowed" : "pointer",
                fontWeight: 900,
              }}
            >
              {authLoading ? "Giriş yapılıyor..." : "Giriş Yap"}
            </button>

            {authErr && (
              <div
                style={{
                  marginTop: 2,
                  color: "crimson",
                  fontWeight: 700,
                  background: "#fff1f2",
                  border: "1px solid #fecdd3",
                  padding: "10px 12px",
                  borderRadius: 10,
                }}
              >
                {authErr}
              </div>
            )}

            <div style={{ marginTop: 6, opacity: 0.7, fontSize: 12 }}>
             
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}