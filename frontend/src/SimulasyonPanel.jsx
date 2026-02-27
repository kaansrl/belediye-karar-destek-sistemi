import { useState } from "react";

export default function SimulasyonPanel() {
  const [simResult, setSimResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState(null);

  async function testGozene() {
    try {
      setLoading(true);
      setErr(null);

      const res = await fetch("http://localhost:3001/api/simulasyon", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          lon: 38.01874058313126,
          lat: 38.1904303,
          radius_m: 5000,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data?.detail || "Simülasyon hata");

      setSimResult(data);
    } catch (e) {
      setErr(e.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ padding: 12 }}>
      <h3>Simülasyon Test (V1)</h3>

      <button onClick={testGozene} disabled={loading}>
        {loading ? "Hesaplanıyor..." : "Gözene testi çalıştır"}
      </button>

      {err && <div style={{ color: "red", marginTop: 10 }}>{err}</div>}

      {simResult && (
        <div style={{ marginTop: 12 }}>
          <div>
            Etkilenen mahalle: <b>{simResult.etkilenen_mahalle_sayisi}</b>
          </div>

          <table border="1" cellPadding="6" style={{ marginTop: 10 }}>
            <thead>
              <tr>
                <th>Mahalle</th>
                <th>Skor (Önce)</th>
                <th>Skor (Sonra)</th>
                <th>İyileşme</th>
              </tr>
            </thead>
            <tbody>
              {simResult.top10.map((r) => (
                <tr key={r.ad}>
                  <td>{r.ad}</td>
                  <td>{r.skor_once}</td>
                  <td>{r.skor_sonra}</td>
                  <td>{r.iyilesme_puani}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
