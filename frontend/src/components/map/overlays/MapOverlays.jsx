// src/components/map/overlays/MapOverlays.jsx
import React from "react";

export const card = {
  background: "rgba(17,24,39,0.88)",
  color: "white",
  border: "1px solid rgba(255,255,255,0.14)",
  borderRadius: 14,
  boxShadow: "0 10px 24px rgba(0,0,0,0.18)",
  backdropFilter: "blur(8px)",
};

export function LegendBox() {
  const items = [
    { c: "#800026", t: "80–100: Kritik" },
    { c: "#e31a1c", t: "60–79: Yüksek" },
    { c: "#fd8d3c", t: "40–59: Orta" },
    { c: "#fff7bc", t: "20–39: Düşük" },
    { c: "#31a354", t: "0–19: Çok iyi" },
  ];

  return (
    <div
      style={{
        position: "absolute",
        zIndex: 999,
        right: 16,
        top: 16,
        padding: "12px 14px",
        fontSize: 13,
        lineHeight: 1.4,
        pointerEvents: "none",
        minWidth: 190,
        ...card,
      }}
    >
      <div style={{ fontWeight: 700, marginBottom: 8 }}>Skor (0 iyi → 100 kötü)</div>

      {items.map((x) => (
        <div key={x.t} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
          <span style={{ width: 14, height: 14, background: x.c, display: "inline-block", borderRadius: 3 }} />
          <span>{x.t}</span>
        </div>
      ))}
    </div>
  );
}

export function ToggleBox({ mode, setMode }) {
  return (
    <div
      style={{
        position: "absolute",
        zIndex: 999,
        left: 16,
        top: 16,
        display: "flex",
        gap: 8,
        padding: 8,
        ...card,
      }}
    >
      <button
        onClick={() => setMode("once")}
        style={{
          cursor: "pointer",
          borderRadius: 8,
          padding: "6px 10px",
          border: "1px solid rgba(255,255,255,0.15)",
          background: mode === "once" ? "rgba(255,255,255,0.18)" : "transparent",
          color: "white",
        }}
      >
        Önce
      </button>

      <button
        onClick={() => setMode("after")}
        style={{
          cursor: "pointer",
          borderRadius: 8,
          padding: "6px 10px",
          border: "1px solid rgba(255,255,255,0.15)",
          background: mode === "after" ? "rgba(255,255,255,0.18)" : "transparent",
          color: "white",
        }}
      >
        Sonra
      </button>
    </div>
  );
}

export function ControlsBox({ tur, setTur, radius, setRadius, mapMode, setMapMode }) {
  return (
    <div
      style={{
        position: "absolute",
        zIndex: 999,
        left: 16,
        top: 72,
        padding: 12,
        fontSize: 13,
        width: 260,
        ...card,
      }}
    >
      <div style={{ fontWeight: 700, marginBottom: 8 }}>Simülasyon Ayarları</div>

      <div style={{ marginBottom: 10 }}>
        <div style={{ marginBottom: 6, opacity: 0.9 }}>Yatırım türü</div>
        <select
          value={tur}
          onChange={(e) => setTur(e.target.value)}
          style={{
            width: "100%",
            padding: "6px 8px",
            borderRadius: 8,
            border: "1px solid rgba(255,255,255,0.15)",
            background: "rgba(255,255,255,0.10)",
            color: "white",
            outline: "none",
          }}
        >
          <option value="okul">Okul</option>
          <option value="park">Park</option>
          <option value="saglik">Sağlık</option>
        </select>
      </div>

      <div style={{ marginBottom: 10 }}>
        <div style={{ marginBottom: 6, opacity: 0.9 }}>Harita modu</div>
        <select
          value={mapMode}
          onChange={(e) => setMapMode(e.target.value)}
          style={{
            width: "100%",
            padding: "6px 8px",
            borderRadius: 8,
            border: "1px solid rgba(255,255,255,0.15)",
            background: "rgba(255,255,255,0.08)",
            color: "white",
            outline: "none",
          }}
        >
          <option value="genel">Genel (Birleşik Skor)</option>
          <option value="tur">Seçili Tür (Erişim Skoru)</option>
        </select>
      </div>

      <div>
        <div style={{ marginBottom: 6, opacity: 0.9 }}>Radius: {radius} m</div>
        <input
          type="range"
          min={500}
          max={10000}
          step={250}
          value={radius}
          onChange={(e) => setRadius(Number(e.target.value))}
          style={{ width: "100%" }}
        />
        <div style={{ display: "flex", justifyContent: "space-between", opacity: 0.7, marginTop: 4 }}>
          <span>500</span>
          <span>10000</span>
        </div>
      </div>
    </div>
  );
}

export function OneriBox({ adaySayisi, setAdaySayisi, topN, setTopN, onRun, onClear, isLoading, count }) {
  return (
    <div
      style={{
        position: "absolute",
        zIndex: 999,
        left: 16,
        top: 380,
        width: 280,
        padding: 12,
        ...card,
        maxHeight: "calc(100% - 420px)",
        overflowY: "auto",
      }}
    >
      <div style={{ fontWeight: 700, marginBottom: 10 }}>Öneri (Akademik)</div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 120px",
          gap: 14,
          marginBottom: 12,
        }}
      >
        <div>
          <div style={{ marginBottom: 6, opacity: 0.9 }}>Aday</div>
          <input
            type="number"
            min={5}
            max={100}
            value={adaySayisi}
            onChange={(e) => setAdaySayisi(Number(e.target.value))}
            style={{
              width: "100%",
              padding: "8px 10px",
              borderRadius: 8,
              border: "1px solid rgba(255,255,255,0.15)",
              background: "rgba(255,255,255,0.08)",
              color: "white",
              outline: "none",
              boxSizing: "border-box",
              minWidth: 0,
            }}
          />
        </div>

        <div>
          <div style={{ marginBottom: 6, opacity: 0.9 }}>Top N</div>
          <input
            type="number"
            min={1}
            max={20}
            value={topN}
            onChange={(e) => setTopN(Number(e.target.value))}
            style={{
              width: "100%",
              padding: "8px 10px",
              borderRadius: 8,
              border: "1px solid rgba(255,255,255,0.15)",
              background: "rgba(255,255,255,0.08)",
              color: "white",
              outline: "none",
              boxSizing: "border-box",
              minWidth: 0,
            }}
          />
        </div>
      </div>

      <button
        onClick={onRun}
        disabled={isLoading}
        style={{
          width: "100%",
          cursor: isLoading ? "not-allowed" : "pointer",
          borderRadius: 8,
          padding: "10px 10px",
          border: "1px solid rgba(255,255,255,0.15)",
          background: isLoading ? "rgba(255,255,255,0.08)" : "rgba(255,255,255,0.14)",
          color: "white",
          fontWeight: 600,
          marginBottom: 10,
        }}
      >
        {isLoading ? "Öneriler hazırlanıyor..." : "En Uygun Noktaları Öner"}
      </button>

      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 10,
          opacity: 0.9,
          marginBottom: 10,
        }}
      >
        <span>Gösterilen öneri: {count}</span>

        <button
          onClick={onClear}
          style={{
            cursor: "pointer",
            borderRadius: 8,
            padding: "6px 10px",
            border: "1px solid rgba(255,255,255,0.15)",
            background: "transparent",
            color: "white",
            whiteSpace: "nowrap",
          }}
        >
          Temizle
        </button>
      </div>

      <div style={{ opacity: 0.8, fontSize: 12, lineHeight: 1.45 }}>
        Aday havuzu yüksek skorlu mahallelerden seçilir; her aday için simülasyon yapılıp en iyi sonuçlar listelenir.
      </div>
    </div>
  );
}