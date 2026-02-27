// frontend/src/components/map/SimSummaryBox.jsx

export default function SimSummaryBox({ lastSim, mapMode }) {
  if (!lastSim) return null;

  return (
    <div
      style={{
        position: "absolute",
        zIndex: 999,
        right: 16,
        bottom: 16,
        width: 340,
        maxHeight: 260,
        overflowY: "auto",
        padding: 14,
        background: "rgba(17,24,39,0.92)",
        color: "white",
        borderRadius: 16,
        border: "1px solid rgba(255,255,255,0.15)",
        boxShadow: "0 12px 28px rgba(0,0,0,0.25)",
        fontSize: 13,
      }}
    >
      <div style={{ fontWeight: 800, marginBottom: 10 }}>
        Etkilenen Mahalle: {lastSim.etkilenen_mahalle_sayisi}
      </div>

      {Array.isArray(lastSim.top10) && lastSim.top10.length > 0 ? (
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ fontSize: 12, opacity: 0.8 }}>
              <th align="left">Mahalle</th>
              <th align="right">Önce</th>
              <th align="right">Sonra</th>
              <th align="right">İyileşme</th>
            </tr>
          </thead>
          <tbody>
            {lastSim.top10.map((m, i) => {
              const once = mapMode === "tur" ? Number(m.skor_once_tur) : Number(m.skor_once);
              const sonra = mapMode === "tur" ? Number(m.skor_sonra_tur) : Number(m.skor_sonra);
              const iyilesme = Number(m.iyilesme_puani);

              return (
                <tr key={i} style={{ borderTop: "1px solid rgba(255,255,255,0.08)" }}>
                  <td style={{ padding: "6px 4px" }}>{m.ad}</td>
                  <td align="right">{Number.isFinite(once) ? once.toFixed(2) : "-"}</td>
                  <td align="right">{Number.isFinite(sonra) ? sonra.toFixed(2) : "-"}</td>
                  <td align="right" style={{ fontWeight: 700 }}>
                    {Number.isFinite(iyilesme) ? iyilesme.toFixed(2) : "-"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      ) : (
        <div>Bu tıklamada etkilenen mahalle çıkmadı.</div>
      )}
    </div>
  );
}