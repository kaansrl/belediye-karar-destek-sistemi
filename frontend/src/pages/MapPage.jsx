import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import Harita from "../components/map/Harita";
import logo from "../assets/Yeşilyurt_Belediyesi_logo.svg.png";

function clearAuth() {
  localStorage.removeItem("token");
  localStorage.removeItem("role");
}

function roleLabel(role) {
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
}

export default function MapPage() {
  const nav = useNavigate();

  const [result, setResult] = useState(null);
  const [mapMode, setMapMode] = useState("genel");

  const [token, setToken] = useState(null);
  const [role, setRole] = useState(null);

  const isTurMode = mapMode === "tur";
  const canSimulate = role === "analyst" || role === "admin";
  const isAdmin = role === "admin";

  useEffect(() => {
    const t = localStorage.getItem("token");
    const r = localStorage.getItem("role");
    if (t) setToken(t);
    if (r) setRole(r);
  }, []);

  const logout = () => {
    clearAuth();
    setToken(null);
    setRole(null);
    setResult(null);
    nav("/login", { replace: true });
  };


  const API_BASE = "http://localhost:3001";

const kaydetSenaryo = async () => {
  try {
    if (!result?.input) {
      alert("Önce simülasyon çalıştır.");
      return;
    }
    if (!token) {
      alert("Giriş yapman lazım.");
      return;
    }

    const isim = prompt(
      "Senaryo adı:",
      `Senaryo - ${result.input.tur} - ${new Date().toLocaleString("tr-TR")}`
    );
    if (!isim) return;

    const payload = {
      name: isim,
      lon: result.input.lon,
      lat: result.input.lat,
      radius_m: result.input.radius_m,
      tur: result.input.tur,
      mode: result.input.mode || mapMode || "genel",
      weights: result.weights,
      result_summary: {
        etkilenen_mahalle_sayisi: result.etkilenen_mahalle_sayisi,
        top10: result.top10,
        input: result.input,
      },
    };

    const r = await fetch(`${API_BASE}/api/senaryolar`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(payload),
    });

    const data = await r.json();
    if (!r.ok) {
      alert(data?.error || "Kaydetme hatası");
      return;
    }

    alert(`Kaydedildi ✅ (id=${data.scenario.id})`);
  } catch (e) {
    console.error(e);
    alert("Kaydetme sırasında hata oluştu.");
  }
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
          <img
            src={logo}
            alt="Yeşilyurt Belediyesi"
            style={{ height: 50 }}
          />
          <div>
            <div style={{ fontSize: 22, fontWeight: 800 }}>
              Mekansal Karar Destek Sistemi
            </div>
            <div style={{ fontSize: 13, opacity: 0.65 }}>
              Hizmet Önceliklendirme ve Yatırım Simülasyonu
            </div>
          </div>
        </div>

        {/* SAĞ: ROL + BUTONLAR */}
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <div
            style={{
              padding: "6px 14px",
              borderRadius: 999,
              background: "#ecfdf5",
              color: "#065f46",
              fontWeight: 600,
              fontSize: 13,
            }}
          >
            {roleLabel(role)}
          </div>

          {isAdmin && (
            <Link
              to="/admin"
              style={{
                textDecoration: "none",
                padding: "8px 14px",
                borderRadius: 8,
                background: "#111827",
                color: "white",
                fontSize: 14,
                fontWeight: 600,
              }}
            >
              Yönetim Paneli
            </Link>
          )}

          <button
            onClick={logout}
            style={{
              padding: "8px 14px",
              borderRadius: 8,
              border: "1px solid #e5e7eb",
              background: "white",
              cursor: "pointer",
              fontWeight: 600,
            }}
          >
            Çıkış
          </button>
        </div>
      </div>

      {/* İÇERİK */}
      <div style={{ padding: 28 }}>
        <div
          style={{
            background: "white",
            borderRadius: 14,
            padding: 20,
            boxShadow: "0 4px 12px rgba(0,0,0,0.05)",
          }}
        >
          <Harita
            onSimResult={setResult}
            mapMode={mapMode}
            setMapMode={setMapMode}
            authToken={token}
            role={role}
            onSaveScenario={kaydetSenaryo}
          />

        </div>

        
      </div>
    </div>
  );
}