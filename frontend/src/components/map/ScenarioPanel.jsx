// frontend/src/components/map/ScenarioPanel.jsx
import { useEffect, useMemo, useState, useCallback } from "react";

const CRITICAL_THRESHOLD = 67;
function mean(nums) {
  const arr = (nums || []).map(Number).filter((x) => Number.isFinite(x));
  if (!arr.length) return 0;
  return arr.reduce((s, x) => s + x, 0) / arr.length;
}

function criticalOutCount(rows, threshold = 67) {
  return (rows || []).filter((r) => Number(r.skor_once) >= threshold && Number(r.skor_sonra) < threshold).length;
}

function topN(rows, n = 5) {
  return [...(rows || [])].sort((a, b) => Number(b.iyilesme) - Number(a.iyilesme)).slice(0, n);
}

function sumIyilesme(arr) {
  return (arr || []).reduce((acc, x) => acc + (Number(x.iyilesme) || 0), 0);
}

function topByIyilesme(arr, n = 5) {
  return [...(arr || [])]
    .sort((a, b) => (Number(b.iyilesme) || 0) - (Number(a.iyilesme) || 0))
    .slice(0, n);
}

function csvEscape(v) {
  if (v === null || v === undefined) return "";
  const s = String(v);
  // virgül, tırnak, satır sonu varsa tırnakla
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function downloadCSV(filename, rows) {
  const csv = rows.map((r) => r.map(csvEscape).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function fmtNum(x) {
  const n = Number(x);
  return Number.isFinite(n) ? n.toFixed(2) : "";
}


export default function ScenarioPanel({
  card,

  // state
  scenarios,
  scenariosLoading,
  scenariosErr,

  scenarioQuery,
  setScenarioQuery,
  filterTur,
  setFilterTur,
  filterMode,
  setFilterMode,
  filterRadius,
  setFilterRadius,

  filteredScenarios,

  // actions
  fetchScenarios,
  applyScenario,
  openScenarioDetail,
  renameScenario,
  deleteScenario,

  // detail
  detailOpenId,
  closeScenarioDetail,
  detailLoading,
  detailErr,
  detailScenario,

  // compare
  compareIds,
  setCompareIds,
  baselineId,
  setBaselineId,

  compareLoading,
  compareErr,
  compareResult,
  runCompare,
  setCompareResult,
  setCompareErr,
  onSaveScenario,
}) {

  // ✅ id -> isim map'i
  const nameById = useMemo(() => {
    const m = new Map();
    (scenarios || []).forEach((s) => m.set(Number(s.id), s.name));
    return m;
  }, [scenarios]);

    const selectedNames = useMemo(() => {
    return (compareIds || []).map((id) => nameById.get(Number(id)) || `#${id}`);
  }, [compareIds, nameById]);

  const baselineName = baselineId ? (nameById.get(Number(baselineId)) || `#${baselineId}`) : "-";

const cellStyleByDelta = (dSkor) => {
  const n = Number(dSkor);
  if (!Number.isFinite(n)) return { color: "rgba(255,255,255,0.70)" };

  if (n < 0) {
    return {
      color: "rgba(34,197,94,0.95)",
      background: "rgba(34,197,94,0.10)",
      border: "1px solid rgba(34,197,94,0.18)",
      borderRadius: 8,
      padding: "4px 6px",
      display: "inline-block",
      minWidth: 74,
      textAlign: "center",
    };
  }
  if (n > 0) {
    return {
      color: "rgba(239,68,68,0.95)",
      background: "rgba(239,68,68,0.10)",
      border: "1px solid rgba(239,68,68,0.18)",
      borderRadius: 8,
      padding: "4px 6px",
      display: "inline-block",
      minWidth: 74,
      textAlign: "center",
    };
  }
  return {
    color: "rgba(255,255,255,0.75)",
    background: "rgba(255,255,255,0.06)",
    border: "1px solid rgba(255,255,255,0.10)",
    borderRadius: 8,
    padding: "4px 6px",
    display: "inline-block",
    minWidth: 74,
    textAlign: "center",
  };
};

// ✅ 2) SADECE FARK OLAN MAHALLELER
const [onlyChanged, setOnlyChanged] = useState(false);
const [matrixSort, setMatrixSort] = useState("mahalle_az"); 
const [winnerMetric, setWinnerMetric] = useState("top10"); 
const displayMatrixRows = useMemo(() => {
  const rows = [...(compareResult?.matrix || [])];

  // 1) filtre (onlyChanged)
  const filtered = !onlyChanged
    ? rows
    : rows.filter((row) =>
        (row.items || []).some((it) => {
          const ds = Number(it?.deltaSkorSonra);
          const di = Number(it?.deltaIyilesme);
          return (Number.isFinite(ds) && ds !== 0) || (Number.isFinite(di) && di !== 0);
        })
      );

  // 2) sıralama (matrixSort)
  const baselineIdNum = Number(compareResult?.baseline?.id);

  const rowImpactScore = (row) => {
    // hedef: satırda baseline dışındaki senaryoların "iyileştirme gücü"
    // ds negatifse iyi -> -ds pozitif katkı, di pozitifse iyi -> +di katkı
    let score = 0;
    for (const it of row.items || []) {
      if (Number(it?.id) === baselineIdNum) continue;

      const ds = Number(it?.deltaSkorSonra);
      const di = Number(it?.deltaIyilesme);

      if (Number.isFinite(ds)) score += -ds; // ds < 0 ise artı katkı
      if (Number.isFinite(di)) score += di;  // di > 0 ise artı katkı
    }
    return score;
  };

  const byNameAZ = (a, b) =>
    String(a?.mahalle_ad || "").localeCompare(String(b?.mahalle_ad || ""), "tr");

  const byNameZA = (a, b) => -byNameAZ(a, b);

  const byBest = (a, b) => rowImpactScore(b) - rowImpactScore(a); // büyük = daha iyi
  const byWorst = (a, b) => rowImpactScore(a) - rowImpactScore(b);

  switch (matrixSort) {
    case "mahalle_za":
      filtered.sort(byNameZA);
      break;
    case "en_iyi":
      filtered.sort(byBest);
      break;
    case "en_kotu":
      filtered.sort(byWorst);
      break;
    default:
      filtered.sort(byNameAZ);
      break;
  }

  return filtered;
}, [compareResult, onlyChanged, matrixSort]);

const exportCompareSummaryCSV = useCallback(() => {
  if (!compareResult) return;

  const rows = [];
  rows.push([
    "senaryo_id",
    "senaryo_adi",
    "referans_mi",
    "etkilenen_mahalle",
    "top10_toplam_iyilesme",
  ]);

  const baseId = Number(compareResult?.baseline?.id);

  (compareResult?.leaderboard || []).forEach((s) => {
    rows.push([
      s.id ?? "",
      s.name ?? "",
      Number(s.id) === baseId ? "Evet" : "Hayır",
      s.etkilenen ?? "",
      fmtNum(s.toplamiyilesmetop10),
    ]);
  });

  const stamp = new Date().toISOString().slice(0, 10);
  downloadCSV(`senaryo_etki_ozeti_${stamp}.csv`, rows);
}, [compareResult]);

const exportMatrixCSV = useCallback(() => {
  if (!compareResult?.matrix?.length) return;

  const scenarios = compareResult?.leaderboard || [];
  const baseId = Number(compareResult?.baseline?.id);

  const header = ["mahalle", "baseline_skor_sonra"];
  scenarios.forEach((s) => {
    const isBase = Number(s.id) === baseId;
    if (isBase) return;
    header.push(`${s.name}_deltaSkorSonra`);
    header.push(`${s.name}_deltaIyilesme`);
  });

  const rows = [header];

  (compareResult.matrix || []).forEach((row) => {
    const baseSkor = row?.baseline?.skor_sonra;
    const itemById = new Map((row.items || []).map((it) => [Number(it.id), it]));

    const r = [row.mahalle_ad ?? "", fmtNum(baseSkor)];

    scenarios.forEach((s) => {
      const isBase = Number(s.id) === baseId;
      if (isBase) return;

      const it = itemById.get(Number(s.id));
      r.push(fmtNum(it?.deltaSkorSonra));
      r.push(fmtNum(it?.deltaIyilesme));
    });

    rows.push(r);
  });

  const stamp = new Date().toISOString().slice(0, 10);
  downloadCSV(`mahalle_fark_matrisi_${stamp}.csv`, rows);
}, [compareResult]);

// ✅ Winner hesaplama (2 metrik)
const winnerCalc = useMemo(() => {
  if (!compareResult) return { winner: null, metricLabel: "", note: "" };

  const baselineIdNum = Number(compareResult?.baseline?.id);

  // 1) Top10 toplam iyileşme (backend leaderboard)
  if (winnerMetric === "top10") {
    const rows = compareResult?.leaderboard || [];
    const winner = rows.length ? rows[0] : null; // backend sıralıysa
    return {
      winner,
      metricLabel: "Toplam iyileşme",
      note: "En etkili senaryo Top10 toplam iyileşmeye göre seçilir.",
    };
  }

  // 2) Baseline'a göre toplam fark (matrix deltaIyilesme toplamı)
  const scores = new Map(); // id -> sumDeltaIyilesme
  for (const row of compareResult?.matrix || []) {
    for (const it of row.items || []) {
      const id = Number(it?.id);
      if (!Number.isFinite(id)) continue;
      if (id === baselineIdNum) continue;

      const di = Number(it?.deltaIyilesme);
      scores.set(id, (scores.get(id) || 0) + (Number.isFinite(di) ? di : 0));
    }
  }

  // leaderboard'dan isim/id alıp en yüksek skoru bul
  const lb = compareResult?.leaderboard || [];
  let best = null;
  let bestScore = -Infinity;

  for (const row of lb) {
    const id = Number(row?.id);
    if (id === baselineIdNum) continue;
    const s = scores.get(id) || 0;

    if (s > bestScore) {
      bestScore = s;
      best = { ...row, baselineDeltaSum: s };
    }
  }

  return {
    winner: best,
    metricLabel: "Baseline'a göre toplam fark",
    note: "Her mahallede baseline'a göre Δİyileşme toplamı (pozitif daha iyi).",
  };
}, [compareResult, winnerMetric]);

  return (
    <div
      style={{
        marginTop: 12,
        padding: 12,
        borderRadius: 14,
        ...card,
      }}
    >
      <div
  style={{
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  }}
>
  {/* SOL */}
  <button
  onClick={async () => {
    try {
      // Kaydetme işlemi Harita.jsx tarafında yapılıyor
      await onSaveScenario?.();

      // ✅ Kaydettikten sonra listeyi yenile
      await fetchScenarios?.();
    } catch (e) {
      console.error("save->refresh failed:", e);
    }
  }}
  style={{
    cursor: "pointer",
    borderRadius: 10,
    padding: "8px 14px",
    border: "1px solid rgba(255,255,255,0.15)",
    background: "rgba(255,255,255,0.12)",
    color: "white",
    fontWeight: 800,
  }}
>
  Senaryoyu Kaydet
</button>

  {/* SAĞ */}
  <div style={{ display: "flex", gap: 8 }}>
    <button
      onClick={runCompare}
      disabled={(compareIds?.length || 0) < 2 || compareLoading}
      style={{
        cursor: (compareIds?.length || 0) < 2 || compareLoading ? "not-allowed" : "pointer",
        borderRadius: 8,
        padding: "6px 10px",
        border: "1px solid rgba(255,255,255,0.15)",
        background:
          (compareIds?.length || 0) < 2 || compareLoading
            ? "rgba(255,255,255,0.06)"
            : "rgba(255,255,255,0.12)",
        color: "white",
        fontWeight: 800,
      }}
    >
      {compareLoading ? "Karşılaştırılıyor..." : "Karşılaştır"}
    </button>

    <button
      onClick={fetchScenarios}
      style={{
        cursor: "pointer",
        borderRadius: 8,
        padding: "6px 10px",
        border: "1px solid rgba(255,255,255,0.15)",
        background: "transparent",
        color: "white",
        fontWeight: 700,
      }}
    >
      Yenile
    </button>
  </div>
</div>

            {/* Compare seçimi + sonuç */}
      <div style={{ marginBottom: 12, display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
        <div style={{ opacity: 0.9, fontSize: 12 }}>
  <div style={{ opacity: 0.9, fontSize: 12, lineHeight: 1.6 }}>
  Seçili ({compareIds?.length || 0}):{" "}
  {selectedNames.length ? <b>{selectedNames.join(" • ")}</b> : "-"}
  <br />
  Baseline: <b>{baselineName}</b>
</div>
  <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
  <div style={{ fontSize: 12, opacity: 0.9 }}>
    Seçili: <b>{(compareIds?.length || 0)}</b>
  </div>

  <select
    value={baselineId ?? ""}
    onChange={(e) => setBaselineId(Number(e.target.value))}
    disabled={compareIds.length === 0}
    style={{
      padding: "6px 10px",
      borderRadius: 10,
      border: "1px solid rgba(255,255,255,0.15)",
      background: "rgba(255,255,255,0.08)",
      color: "white",
      outline: "none",
    }}
  >
    {compareIds.map((id) => (
      <option key={id} value={id}>
        Baseline: {nameById.get(Number(id)) || `#${id}`}
      </option>
    ))}
  </select>

  <button
    onClick={() => {
      setCompareIds([]);
      setBaselineId(null);
      setCompareResult(null);
      setCompareErr(null);
    }}
    style={{
      cursor: "pointer",
      borderRadius: 8,
      padding: "6px 10px",
      border: "1px solid rgba(255,255,255,0.15)",
      background: "transparent",
      color: "white",
      fontWeight: 700,
    }}
  >
    Seçimi temizle
  </button>
</div>
</div>
      </div>

      {compareErr && <div style={{ color: "#fecaca", marginBottom: 10 }}>{compareErr}</div>}
 
    {compareResult && (() => {
  // ✅ backend leaderboard'u en iyi -> en kötü sıralı döndürüyorsa
 const winner = winnerCalc?.winner || null;

  return (
    <div style={{ marginBottom: 16 }}>
      {/* Başlık */}
      <div style={{ fontWeight: 900, fontSize: 16, marginBottom: 12 }}>
        Karşılaştırma Özeti
      </div>
    <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", marginBottom: 10 }}>
  <div style={{ fontSize: 12, opacity: 0.85 }}>Kazanan ölçütü:</div>

  <select
    value={winnerMetric}
    onChange={(e) => setWinnerMetric(e.target.value)}
    style={{
      padding: "6px 10px",
      borderRadius: 10,
      border: "1px solid rgba(255,255,255,0.15)",
      background: "rgba(255,255,255,0.08)",
      color: "white",
      outline: "none",
      fontSize: 12,
      fontWeight: 800,
    }}
  >
    <option value="top10">Top10 toplam iyileşme</option>
    <option value="baseline">Baseline’a göre toplam fark</option>
  </select>

  <div style={{ fontSize: 12, opacity: 0.7 }}>
    {winnerCalc?.note}
  </div>
</div>


    {/* 📊 Senaryo Etki Grafiği (Toplam İyileşme + Etkilenen) */}
{(compareResult?.leaderboard?.length || 0) > 0 && (() => {
  const rows = compareResult.leaderboard || [];
  const maxImp = Math.max(...rows.map(r => Number(r.toplamiyilesmetop10) || 0), 1);
  const maxEtk = Math.max(...rows.map(r => Number(r.etkilenen) || 0), 1);

  return (
    <div
      style={{
        padding: 12,
        borderRadius: 12,
        background: "rgba(255,255,255,0.06)",
        border: "1px solid rgba(255,255,255,0.10)",
        marginBottom: 14,
      }}
    >
      <div style={{ fontWeight: 900, marginBottom: 8 }}>
        Senaryo Etki Karşılaştırması
      </div>

      <div style={{ fontSize: 12, opacity: 0.8, marginBottom: 10, lineHeight: 1.5 }}>
        Çubuk uzunluğu: Top10 toplam iyileşme (yüksek = daha iyi).<br />
        İnce çubuk: Etkilenen mahalle sayısı (yüksek = daha geniş etki).
      </div>

      <div style={{ display: "grid", gap: 10 }}>
        {rows.map((r) => {
          const imp = Number(r.toplamiyilesmetop10) || 0;
          const etk = Number(r.etkilenen) || 0;

          const impPct = Math.round((imp / maxImp) * 100);
          const etkPct = Math.round((etk / maxEtk) * 100);

          const isBase = Number(r.id) === Number(compareResult?.baseline?.id);

          return (
            <div key={r.id} style={{ display: "grid", gap: 6 }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
                <div style={{ fontWeight: isBase ? 900 : 800 }}>
                  {r.name}{isBase ? " (Referans)" : ""}
                </div>
                <div style={{ fontSize: 12, opacity: 0.85 }}>
                  İyileşme: <b>{imp.toFixed(2)}</b> · Etkilenen: <b>{etk}</b>
                </div>
              </div>

              {/* Ana bar: iyileşme */}
              <div style={{ height: 10, background: "rgba(255,255,255,0.08)", borderRadius: 999 }}>
                <div
                  style={{
                    height: "100%",
                    width: `${impPct}%`,
                    borderRadius: 999,
                    background: "rgba(34,197,94,0.70)",
                  }}
                />
              </div>

              {/* Mini bar: etkilenen */}
              <div style={{ height: 6, background: "rgba(255,255,255,0.06)", borderRadius: 999 }}>
                <div
                  style={{
                    height: "100%",
                    width: `${etkPct}%`,
                    borderRadius: 999,
                    background: "rgba(59,130,246,0.65)",
                  }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
})()}


      {/* ✅ Kazanan (sade) */}
      {winner && (
  <div
    style={{
      padding: 12,
      borderRadius: 12,
      background: "rgba(34,197,94,0.15)",
      border: "1px solid rgba(34,197,94,0.25)",
      marginBottom: 14,
    }}
  >
    <div style={{ fontWeight: 900 }}>
      En Etkili Senaryo: {winner.name}
    </div>

    <div style={{ fontSize: 13, marginTop: 4 }}>
  Ölçüt değeri:{" "}
  <b>
    {winnerMetric === "top10"
      ? Number(winner?.toplamiyilesmetop10 || 0).toFixed(2)
      : Number(winner?.baselineDeltaSum || 0).toFixed(2)}
  </b>
  <div style={{ fontSize: 12, opacity: 0.7, marginTop: 6 }}>
  * {winnerCalc?.note}
</div>
</div>
       

  </div>
)}

      {/* Referans (isteğe bağlı ama anlaşılır) */}
      {compareResult?.baseline && (
        <div
          style={{
            padding: 12,
            borderRadius: 12,
            background: "rgba(255,255,255,0.06)",
            marginBottom: 12,
          }}
        >
          <div style={{ fontSize: 13, opacity: 0.8 }}>Referans Senaryo</div>
          <div style={{ fontWeight: 900, fontSize: 15 }}>
            {compareResult.baseline.name}
          </div>
          <div style={{ fontSize: 13, marginTop: 4, opacity: 0.85 }}>
            Etkilenen mahalle: <b>{compareResult.baseline.etkilenen ?? 0}</b>
          </div>
        </div>
      )}

      {/* Diğer Senaryolar */}
      <div
        style={{
          padding: 12,
          borderRadius: 12,
          background: "rgba(255,255,255,0.06)",
        }}
      >
        <div style={{ fontWeight: 800, marginBottom: 8 }}>
          Senaryoların Etkisi
        </div>

        {(compareResult.leaderboard || []).map((row, idx) => {
          const isBase = Number(row.id) === Number(compareResult?.baseline?.id);

          return (
            <div
              key={row.id}
              style={{
                padding: "6px 0",
                opacity: isBase ? 1 : 0.9,
              }}
            >
              <div style={{ fontWeight: isBase ? 900 : 700 }}>
                {idx + 1}. {row.name}
                {isBase ? " (Referans)" : ""}
              </div>

              <div style={{ fontSize: 13, opacity: 0.8 }}>
                Etkilenen mahalle: <b>{row.etkilenen ?? 0}</b>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
})()}

{/* ✅ MAHALLE FARK MATRİSİ (Multi) */}
{compareResult?.matrix?.length > 0 && (
  <div
    style={{
      padding: 12,
      borderRadius: 12,
      background: "rgba(255,255,255,0.06)",
      marginBottom: 14,
    }}
  >
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, marginBottom: 10 }}>
  <div style={{ fontWeight: 900, fontSize: 15 }}>
    Mahalle Fark Matrisi
  </div>

  <div style={{ display: "flex", gap: 8 }}>
    <button
      onClick={exportCompareSummaryCSV}
      disabled={!compareResult}
      style={{
        cursor: !compareResult ? "not-allowed" : "pointer",
        borderRadius: 8,
        padding: "6px 10px",
        border: "1px solid rgba(255,255,255,0.15)",
        background: !compareResult ? "rgba(255,255,255,0.06)" : "rgba(255,255,255,0.12)",
        color: "white",
        fontWeight: 800,
        fontSize: 12,
      }}
    >
      CSV İndir (Özet)
    </button>

    <button
      onClick={exportMatrixCSV}
      disabled={!compareResult?.matrix?.length}
      style={{
        cursor: !compareResult?.matrix?.length ? "not-allowed" : "pointer",
        borderRadius: 8,
        padding: "6px 10px",
        border: "1px solid rgba(255,255,255,0.15)",
        background: !compareResult?.matrix?.length ? "rgba(255,255,255,0.06)" : "rgba(255,255,255,0.12)",
        color: "white",
        fontWeight: 800,
        fontSize: 12,
      }}
    >
      CSV İndir (Matris)
    </button>
  </div>
</div>

    <div style={{ fontSize: 12, opacity: 0.7, marginBottom: 8 }}>
  ΔSkorSonra: Negatif değer iyileşme anlamına gelir. <br />
  Δİyileşme: Pozitif değer hizmet erişiminin arttığını gösterir.
</div>

<div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 10 }}>
  <label style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 12, opacity: 0.9 }}>
    <input
      type="checkbox"
      checked={onlyChanged}
      onChange={(e) => setOnlyChanged(e.target.checked)}
    />
    Sadece fark olan mahalleleri göster
  </label>

  <div style={{ fontSize: 12, opacity: 0.75 }}>
    Gösterilen satır: <b>{displayMatrixRows.length}</b>
  </div>

  <select
  value={matrixSort}
  onChange={(e) => setMatrixSort(e.target.value)}
  style={{
    marginLeft: 12,
    padding: "6px 10px",
    borderRadius: 10,
    border: "1px solid rgba(255,255,255,0.15)",
    background: "rgba(255,255,255,0.08)",
    color: "white",
    outline: "none",
    fontSize: 12,
  }}
>
  <option value="mahalle_az">Sırala: Mahalle (A→Z)</option>
  <option value="mahalle_za">Sırala: Mahalle (Z→A)</option>
  <option value="en_iyi">Sırala: En çok iyileşen</option>
  <option value="en_kotu">Sırala: En kötüleşen</option>
</select>
</div>


    <div style={{ overflowX: "auto" }}>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
        <thead>
          <tr style={{ textAlign: "left", opacity: 0.85 }}>
            <th style={{ padding: "8px 6px", borderBottom: "1px solid rgba(255,255,255,0.10)" }}>
              Mahalle
            </th>
            <th style={{ padding: "8px 6px", borderBottom: "1px solid rgba(255,255,255,0.10)" }}>
              Baseline Skor (Sonra)
            </th>

            {/* seçili senaryolar kolonları */}
            {(compareResult?.leaderboard || []).map((s) => (
              <th
                key={s.id}
                style={{ padding: "8px 6px", borderBottom: "1px solid rgba(255,255,255,0.10)" }}
              >
                {s.name}
                <div style={{ fontSize: 11, opacity: 0.7, marginTop: 2 }}>
                  ΔSkorSonra / Δİyileşme
                </div>
              </th>
            ))}
          </tr>
        </thead>

        <tbody>
          {displayMatrixRows.map((row, idx) => {
            const baseSkor = Number(row?.baseline?.skor_sonra);
            const baseSkorText = Number.isFinite(baseSkor) ? baseSkor.toFixed(2) : "-";

            // items: senaryo id -> item map
            const itemById = new Map((row.items || []).map((it) => [Number(it.id), it]));

            return (
              <tr key={`${row.mahalle_ad}-${idx}`} style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
                <td style={{ padding: "8px 6px", fontWeight: 800 }}>
                  {row.mahalle_ad}
                </td>

                <td style={{ padding: "8px 6px", opacity: 0.9 }}>
                  {baseSkorText}
                </td>

                {(compareResult?.leaderboard || []).map((s) => {
                  const isBase = Number(s.id) === Number(compareResult?.baseline?.id);
                  const it = itemById.get(Number(s.id));
                  const dSkor = Number(it?.deltaSkorSonra);
                  const dIy = Number(it?.deltaIyilesme);

                  const dSkorText = isBase ? "-" : (Number.isFinite(dSkor) ? dSkor.toFixed(2) : "-");
                  const dIyText   = isBase ? "-" : (Number.isFinite(dIy) ? dIy.toFixed(2) : "-");

                  // küçük görsel ipucu: iyileşme negatif deltaSkorSonra (skor düşerse iyileşme)
                  const good = Number.isFinite(dSkor) ? dSkor < 0 : false;

                  return (
                    <td key={s.id} style={{ padding: "8px 6px", opacity: 0.95 }}>
  {isBase ? (
    <span style={{ opacity: 0.7 }}>-</span>
  ) : (
    <span style={cellStyleByDelta(dSkor)}>
      <b>{dSkorText}</b>
      <span style={{ opacity: 0.85 }}> / {dIyText}</span>
    </span>
  )}
</td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  </div>
)}

      {/* Arama + Filtre */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1.4fr 1fr 1fr 1fr",
          gap: 10,
          marginBottom: 12,
        }}
      >
        <input
          value={scenarioQuery}
          onChange={(e) => setScenarioQuery(e.target.value)}
          placeholder="Ara: isim / tur / mode / radius"
          style={{
            padding: "8px 10px",
            borderRadius: 10,
            border: "1px solid rgba(255,255,255,0.15)",
            background: "rgba(255,255,255,0.08)",
            color: "white",
            outline: "none",
          }}
        />

        <select
          value={filterTur}
          onChange={(e) => setFilterTur(e.target.value)}
          style={{
            padding: "8px 10px",
            borderRadius: 10,
            border: "1px solid rgba(255,255,255,0.15)",
            background: "rgba(255,255,255,0.08)",
            color: "white",
            outline: "none",
          }}
        >
          <option value="all">Tur: Hepsi</option>
          <option value="okul">okul</option>
          <option value="park">park</option>
          <option value="saglik">saglik</option>
        </select>

        <select
          value={filterMode}
          onChange={(e) => setFilterMode(e.target.value)}
          style={{
            padding: "8px 10px",
            borderRadius: 10,
            border: "1px solid rgba(255,255,255,0.15)",
            background: "rgba(255,255,255,0.08)",
            color: "white",
            outline: "none",
          }}
        >
          <option value="all">Mode: Hepsi</option>
          <option value="genel">genel</option>
          <option value="tur">tur</option>
        </select>

        <select
          value={filterRadius}
          onChange={(e) => setFilterRadius(e.target.value)}
          style={{
            padding: "8px 10px",
            borderRadius: 10,
            border: "1px solid rgba(255,255,255,0.15)",
            background: "rgba(255,255,255,0.08)",
            color: "white",
            outline: "none",
          }}
        >
          <option value="all">Radius: Hepsi</option>
          <option value="3000">3000</option>
          <option value="5000">5000</option>
          <option value="5750">5750</option>
          <option value="10000">10000</option>
        </select>
      </div>

      {scenariosLoading && <div>Yükleniyor...</div>}
      {scenariosErr && <div style={{ color: "#fecaca" }}>{scenariosErr}</div>}

      {!scenariosLoading && !scenariosErr && scenarios.length === 0 && <div>Henüz senaryo yok.</div>}

      {!scenariosLoading && !scenariosErr && filteredScenarios.length === 0 && <div>Filtreye uygun senaryo yok.</div>}

      {!scenariosLoading && filteredScenarios.length > 0 && (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
            gap: 10,
          }}
        >
          {filteredScenarios.map((s) => {
            const idNum = Number(s.id);
  const isSelected = (compareIds || []).includes(Number(s.id));


  return (
    <div
      key={s.id}
      style={{
        padding: 12,
        borderRadius: 12,
        border: "1px solid rgba(255,255,255,0.12)",
        background: "rgba(255,255,255,0.06)",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
        <div style={{ fontWeight: 900, fontSize: 14, lineHeight: 1.2 }}>{s.name}</div>
        <div style={{ opacity: 0.7, fontSize: 12 }}>#{s.id}</div>
      </div>

      <div style={{ opacity: 0.85, fontSize: 12, lineHeight: 1.6, marginTop: 8, marginBottom: 10 }}>
        Tür: <b>{s.tur}</b> | Mode: <b>{s.mode}</b> | Radius: <b>{s.radius_m}</b> m
        <br />
        Konum: {Number(s.lat).toFixed(5)}, {Number(s.lon).toFixed(5)}
      </div>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <button
          onClick={() => {
            setCompareErr(null);
            setCompareResult(null);

            setCompareIds((prev) => {
              const id = Number(s.id);
              const has = (prev || []).includes(id);

              if (has) {
                const next = (prev || []).filter((x) => x !== id);
                if (Number(baselineId) === id) setBaselineId(next[0] ?? null);
                return next;
              }

              const next = [...(prev || []), id];
              if (!baselineId) setBaselineId(id);
              return next;
            });
          }}
          style={{
            cursor: "pointer",
            borderRadius: 8,
            padding: "7px 10px",
            border: "1px solid rgba(255,255,255,0.15)",
            background: isSelected ? "rgba(255,255,255,0.18)" : "transparent",
            color: "white",
            fontWeight: 800,
          }}
        >
          {isSelected ? "Seçildi ✓" : "Seç"}
        </button>

        <button
          onClick={() => applyScenario(s)}
          style={{
            cursor: "pointer",
            borderRadius: 8,
            padding: "7px 10px",
            border: "1px solid rgba(255,255,255,0.15)",
            background: "rgba(255,255,255,0.12)",
            color: "white",
            fontWeight: 800,
          }}
        >
          Uygula
        </button>

        <button
          onClick={() => openScenarioDetail(s.id)}
          style={{
            cursor: "pointer",
            borderRadius: 8,
            padding: "7px 10px",
            border: "1px solid rgba(255,255,255,0.15)",
            background: "transparent",
            color: "white",
            fontWeight: 700,
          }}
        >
          Detay
        </button>

        <button
          onClick={() => renameScenario(s)}
          style={{
            cursor: "pointer",
            borderRadius: 8,
            padding: "7px 10px",
            border: "1px solid rgba(255,255,255,0.15)",
            background: "transparent",
            color: "white",
            fontWeight: 700,
          }}
        >
          Ad değiştir
        </button>

        <button
          onClick={() => deleteScenario(s.id)}
          style={{
            cursor: "pointer",
            borderRadius: 8,
            padding: "7px 10px",
            border: "1px solid rgba(255,255,255,0.15)",
            background: "rgba(255,0,0,0.12)",
            color: "white",
            fontWeight: 800,
          }}
        >
          Sil
        </button>
      </div>
    </div>
  );
})}
        </div>
      )}

      {detailOpenId && (
  <div
    style={{
      marginTop: 12,
      padding: 12,
      borderRadius: 12,
      border: "1px solid rgba(255,255,255,0.12)",
      background: "rgba(0,0,0,0.20)",
    }}
  >
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
      <div style={{ fontWeight: 900 }}>Senaryo Detayı</div>

      <button
        onClick={closeScenarioDetail}
        style={{
          cursor: "pointer",
          borderRadius: 8,
          padding: "6px 10px",
          border: "1px solid rgba(255,255,255,0.15)",
          background: "transparent",
          color: "white",
          fontWeight: 800,
        }}
      >
        Kapat
      </button>
    </div>

    {detailLoading && <div style={{ marginTop: 8 }}>Yükleniyor...</div>}
    {detailErr && <div style={{ marginTop: 8, color: "#fecaca" }}>{detailErr}</div>}

    {!detailLoading && !detailErr && detailScenario && (
      <div style={{ marginTop: 10, fontSize: 12, lineHeight: 1.6, opacity: 0.95 }}>
        <div>
          <b>İsim:</b> {detailScenario.name}
        </div>
        <div>
          <b>Tür:</b> {detailScenario.tur} | <b>Mode:</b> {detailScenario.mode} | <b>Radius:</b>{" "}
          {detailScenario.radius_m} m
        </div>
        <div>
          <b>Konum:</b> {Number(detailScenario.lat).toFixed(6)}, {Number(detailScenario.lon).toFixed(6)}
        </div>

        <hr style={{ border: "none", borderTop: "1px solid rgba(255,255,255,0.10)", margin: "10px 0" }} />

        <div style={{ fontWeight: 800, marginBottom: 6 }}>Özet</div>

        <pre
          style={{
            whiteSpace: "pre-wrap",
            wordBreak: "break-word",
            background: "rgba(255,255,255,0.06)",
            padding: 10,
            borderRadius: 10,
            border: "1px solid rgba(255,255,255,0.10)",
            margin: 0,
          }}
        >
          {JSON.stringify(detailScenario?.result_summary ?? {}, null, 2)}
        </pre>
      </div>
    )}
  </div>
)}
    </div>
  );
}