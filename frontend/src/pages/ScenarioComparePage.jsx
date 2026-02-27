import { useMemo, useState } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";

export default function ScenarioComparePage() {
  const [aId, setAId] = useState("16"); // istersen boş bırak
  const [bId, setBId] = useState("1");
  const [loading, setLoading] = useState(false);
  const [compare, setCompare] = useState(null);
  const [err, setErr] = useState("");

  async function runCompare() {
    setErr("");
    setLoading(true);
    setCompare(null);

    try {
      const token = localStorage.getItem("token") || "";
      if (!token) throw new Error("Token yok. Önce /login ile giriş yap.");

      const res = await fetch("http://localhost:3001/api/senaryolar/compare", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          a_id: Number(aId),
          b_id: Number(bId),
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || `Compare failed: ${res.status}`);

      setCompare(data);
    } catch (e) {
      setErr(e.message || "Hata");
    } finally {
      setLoading(false);
    }
  }

  // JSON'un senin formatına göre listeleri alıyoruz
  const sadeceA = useMemo(() => (compare?.sadeceA ?? []), [compare]);
  const sadeceB = useMemo(() => (compare?.sadeceB ?? []), [compare]);
  const ortak = useMemo(() => (compare?.ortak ?? []), [compare]);

  // Bu ekranda pratik KPI:
  // - A Top10 toplam iyileşme (backend zaten veriyor)
  // - B Top10 toplam iyileşme
  // - A'nın etkilenen mahalle sayısı, B'nin etkilenen mahalle sayısı
  const kpi = useMemo(() => {
    if (!compare) return null;

    const aTop = Number(compare?.a?.toplamIyilesmeTop10 ?? 0);
    const bTop = Number(compare?.b?.toplamIyilesmeTop10 ?? 0);
    const aEtki = Number(compare?.a?.etkilenen ?? 0);
    const bEtki = Number(compare?.b?.etkilenen ?? 0);

    // kritik tanımı: skor_sonra >= 67 (istersen skor_once >=67 da ekleyebiliriz)
    const criticalA = sadeceA.filter((r) => Number(r.skor_sonra ?? -Infinity) >= 67).length;
    const criticalB = sadeceB.filter((r) => Number(r.skor_sonra ?? -Infinity) >= 67).length;

    return {
      aTop,
      bTop,
      diffTop: aTop - bTop,
      aEtki,
      bEtki,
      diffEtki: aEtki - bEtki,
      criticalA,
      criticalB,
      diffCritical: criticalA - criticalB,
    };
  }, [compare, sadeceA, sadeceB]);

  const chartIyilesme = useMemo(() => {
    if (!kpi) return [];
    return [
      { name: `A (${compare?.a?.id})`, value: Number(kpi.aTop.toFixed(2)) },
      { name: `B (${compare?.b?.id})`, value: Number(kpi.bTop.toFixed(2)) },
    ];
  }, [kpi, compare]);

  const chartEtkilenen = useMemo(() => {
    if (!kpi) return [];
    return [
      { name: `A (${compare?.a?.id})`, value: kpi.aEtki },
      { name: `B (${compare?.b?.id})`, value: kpi.bEtki },
    ];
  }, [kpi, compare]);

  // Tablo: A'nın top iyileşmeleri (sadeceA zaten iyilesme içeriyor)
  const top5A = useMemo(() => {
    return [...sadeceA]
      .sort((x, y) => Number(y.iyilesme ?? 0) - Number(x.iyilesme ?? 0))
      .slice(0, 5);
  }, [sadeceA]);

  // Tablo: Ortak listesi varsa fark tablosu (şu an boş geliyor ama ileride dolacak)
  const top5OrtakFark = useMemo(() => {
    return [...ortak]
      .map((r) => ({
        ad: r.ad,
        iyilesmeA: Number(r.iyilesme_a ?? 0),
        iyilesmeB: Number(r.iyilesme_b ?? 0),
        diff: Number(r.iyilesme_a ?? 0) - Number(r.iyilesme_b ?? 0),
      }))
      .sort((x, y) => Math.abs(y.diff) - Math.abs(x.diff))
      .slice(0, 5);
  }, [ortak]);

  return (
    <div style={{ padding: 16, maxWidth: 1100, margin: "0 auto" }}>
      <h2>Senaryo Karşılaştırma</h2>

      {/* Seçim alanı */}
      <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 12 }}>
        <input
          placeholder="Senaryo A ID"
          value={aId}
          onChange={(e) => setAId(e.target.value)}
          style={{ padding: 8, width: 140 }}
        />
        <input
          placeholder="Senaryo B ID"
          value={bId}
          onChange={(e) => setBId(e.target.value)}
          style={{ padding: 8, width: 140 }}
        />
        <button
          onClick={runCompare}
          disabled={loading || !aId || !bId}
          style={{ padding: "8px 12px" }}
        >
          {loading ? "Karşılaştırılıyor..." : "Karşılaştır"}
        </button>

        {err && <span style={{ color: "crimson" }}>{err}</span>}
      </div>

      {/* Başlıklar */}
      {compare && (
        <div style={{ marginBottom: 12, color: "#444" }}>
          <div><b>A:</b> {compare?.a?.name} (id={compare?.a?.id})</div>
          <div><b>B:</b> {compare?.b?.name} (id={compare?.b?.id})</div>
        </div>
      )}

      {/* KPI Kartları */}
      {kpi && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12, marginBottom: 12 }}>
          <KpiCard title="Top10 Toplam İyileşme (A)" value={kpi.aTop.toFixed(2)} />
          <KpiCard title="Top10 Toplam İyileşme (B)" value={kpi.bTop.toFixed(2)} />
          <KpiCard title="Fark (A - B)" value={kpi.diffTop.toFixed(2)} />
        </div>
      )}

      {kpi && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12, marginBottom: 12 }}>
          <KpiCard title="Etkilenen Mahalle (A)" value={String(kpi.aEtki)} />
          <KpiCard title="Etkilenen Mahalle (B)" value={String(kpi.bEtki)} />
          <KpiCard title="Fark (A - B)" value={String(kpi.diffEtki)} />
        </div>
      )}

      {/* Grafikler */}
      {kpi && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <ChartCard title="Top10 Toplam İyileşme (A vs B)">
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={chartIyilesme}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="value" />
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>

          <ChartCard title="Etkilenen Mahalle Sayısı (A vs B)">
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={chartEtkilenen}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="value" />
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>
        </div>
      )}

      {/* Tablo */}
      {!!top5A.length && (
        <div style={{ marginTop: 12, border: "1px solid #ddd", borderRadius: 8, padding: 12 }}>
          <h3 style={{ marginTop: 0 }}>A Senaryosunda En Çok İyileşen İlk 5</h3>
          <SimpleTable
            columns={["Mahalle", "İyileşme", "Skor Once", "Skor Sonra", "Yeni Hizmet (m)"]}
            rows={top5A.map((r) => [
              r.ad,
              Number(r.iyilesme ?? 0).toFixed(2),
              Number(r.skor_once ?? 0).toFixed(2),
              Number(r.skor_sonra ?? 0).toFixed(2),
              String(r.yeni_hizmet_m ?? "-"),
            ])}
          />
          <div style={{ marginTop: 8, color: "#666", fontSize: 12 }}>
            Not: Şu an B senaryosu etkilemediği için (etkilenen=0) veriler “sadeceA” listesinde.
            İki senaryo da etkilerse “ortak” listesi üzerinden fark tablosu da gösterilebilir.
          </div>
        </div>
      )}

      {!!top5OrtakFark.length && (
        <div style={{ marginTop: 12, border: "1px solid #ddd", borderRadius: 8, padding: 12 }}>
          <h3 style={{ marginTop: 0 }}>Ortak Mahallelerde En Büyük Fark (Top 5)</h3>
          <SimpleTable
            columns={["Mahalle", "İyileşme A", "İyileşme B", "Fark (A-B)"]}
            rows={top5OrtakFark.map((r) => [
              r.ad,
              r.iyilesmeA.toFixed(2),
              r.iyilesmeB.toFixed(2),
              r.diff.toFixed(2),
            ])}
          />
        </div>
      )}

      {!compare && !loading && (
        <div style={{ marginTop: 12, color: "#666" }}>
          İki senaryo ID girip “Karşılaştır” deyince KPI + grafik + tablo oluşacak.
        </div>
      )}
    </div>
  );
}

function KpiCard({ title, value }) {
  return (
    <div style={{ border: "1px solid #ddd", borderRadius: 8, padding: 12 }}>
      <div style={{ color: "#666", fontSize: 12 }}>{title}</div>
      <div style={{ fontSize: 22, fontWeight: 700 }}>{value}</div>
    </div>
  );
}

function ChartCard({ title, children }) {
  return (
    <div style={{ border: "1px solid #ddd", borderRadius: 8, padding: 12 }}>
      <div style={{ fontWeight: 700, marginBottom: 8 }}>{title}</div>
      {children}
    </div>
  );
}

function SimpleTable({ columns, rows }) {
  return (
    <table style={{ width: "100%", borderCollapse: "collapse" }}>
      <thead>
        <tr>
          {columns.map((c) => (
            <th key={c} style={th}>{c}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((r, idx) => (
          <tr key={idx}>
            {r.map((cell, j) => (
              <td key={j} style={td}>{cell}</td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

const th = { textAlign: "left", borderBottom: "1px solid #eee", padding: 8 };
const td = { borderBottom: "1px solid #f2f2f2", padding: 8 };