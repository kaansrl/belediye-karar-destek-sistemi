import { useEffect, useMemo, useState, useCallback, useRef } from "react";
import { MapContainer, TileLayer, GeoJSON, Marker, Popup, Circle } from "react-leaflet";
import L from "leaflet";
import { LegendBox, ToggleBox, ControlsBox, OneriBox, card } 
from "./overlays/MapOverlays";


// ✅ Marker ikon fix
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

const keyOf = (s) =>
  String(s ?? "")
    .trim()
    .toLocaleLowerCase("tr-TR")
    .replace(/\s+/g, " ")
    .replace(/[’'`´]/g, "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "");
    

// ✅ 5 kademeli renk (0 iyi → 100 kötü)
function colorByScore(skor) {
  if (skor >= 80) return "#800026";
  if (skor >= 60) return "#e31a1c";
  if (skor >= 40) return "#fd8d3c";
  if (skor >= 20) return "#fff7bc";
  return "#31a354";
}

export default function Harita({ onSimResult, authToken, role, mapMode, setMapMode }) {
  const mapRef = useRef(null);
  const [geojson, setGeojson] = useState(null);

  const [clicked, setClicked] = useState({ lat: 38.33, lon: 38.30 });
  const [lastSim, setLastSim] = useState(null);
  const [mode, setMode] = useState("once");

  const [tur, setTur] = useState("okul");
  const [radius, setRadius] = useState(5000);
const [saving, setSaving] = useState(false);
const [lastSavedId, setLastSavedId] = useState(null);
  // ✅ Harita skor modu
  
const [scenarios, setScenarios] = useState([]);
const [scenariosLoading, setScenariosLoading] = useState(false);
const [scenariosErr, setScenariosErr] = useState(null);

  // ✅ Öneriler (Akademik)
  const [adaySayisi, setAdaySayisi] = useState(25);
  const [topN, setTopN] = useState(5);
  const [oneriler, setOneriler] = useState([]); // [{aday_mahalle, lon, lat, ...}]
  const [onerilerLoading, setOnerilerLoading] = useState(false);

  // ✅ UI state
const [scenarioQuery, setScenarioQuery] = useState("");
const [filterTur, setFilterTur] = useState("all");   // all | okul | park | saglik
const [filterMode, setFilterMode] = useState("all"); // all | genel | tur
const [filterRadius, setFilterRadius] = useState("all"); // all | 3000 | 5000 | 5750 vs

const [detailOpenId, setDetailOpenId] = useState(null);
const [detailLoading, setDetailLoading] = useState(false);
const [detailErr, setDetailErr] = useState(null);
const [detailScenario, setDetailScenario] = useState(null);

  const center = useMemo(() => [38.33, 38.30], []);

  const debounceRef = useRef(null);
  const hasInteractedRef = useRef(false);
  const simReqIdRef = useRef(0);
  const canSimulate = role === "analyst" || role === "admin";
  useEffect(() => {
  if (!canSimulate) {
    setLastSim(null);
    setMode("once");
    setOneriler([]);
    onSimResult?.(null);
  }
}, [canSimulate, onSimResult]);



  // ✅ GeoJSON fetch: mapMode/tur değişince renk kaynağı değişsin
  useEffect(() => {
  const url =
    mapMode === "tur"
      ? `http://localhost:3001/api/mahalleler/geojson?mode=tur&tur=${encodeURIComponent(tur)}`
      : `http://localhost:3001/api/mahalleler/geojson`;

  fetch(url, { cache: "no-store" })
    .then((r) => r.json())
    .then(setGeojson)
    .catch((e) => console.error("GeoJSON fetch hata:", e));
}, [mapMode, tur]);




useEffect(() => {
  setMode("once");
  setLastSim(null);
  setOneriler([]);     // ✅ önerileri temizle
}, [mapMode, tur]);





  const clearOneriler = useCallback(() => {
    setOneriler([]);
  }, []);

const runSim = useCallback(
  async (lat, lng, weightsOverride = null) => {
    if (!canSimulate) return;

    const reqId = ++simReqIdRef.current;

    const payload = {
      lon: lng,
      lat,
      radius_m: radius,
      tur,
      mode: mapMode,
      weights: weightsOverride ?? null,
    };

    const headers = { "Content-Type": "application/json" };
    if (authToken) headers.Authorization = `Bearer ${authToken}`;

    const res = await fetch("http://localhost:3001/api/simulasyon", {
      method: "POST",
      headers,
      body: JSON.stringify(payload),
    });

    const data = await res.json();

    // eski istek geldiyse çöpe at
    if (reqId !== simReqIdRef.current) return;

    setLastSim(data);
    onSimResult?.(data);
    setMode("after");
  },
  [onSimResult, radius, tur, mapMode, authToken, canSimulate]
);

  // ✅ Radius/tür değişince simülasyonu yeniden çalıştır (debounce)
  // + önerileri otomatik temizle (stale kalmasın)
  useEffect(() => {
  if (!canSimulate) return;
  if (!hasInteractedRef.current) return;

  clearOneriler();

  if (debounceRef.current) clearTimeout(debounceRef.current);

  debounceRef.current = setTimeout(() => {
    runSim(clicked.lat, clicked.lon);
  }, 300);

  return () => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
  };
}, [canSimulate, radius, tur, mapMode, clicked.lat, clicked.lon, runSim, clearOneriler]);


  // mode=after iken sadece etkilenen mahalleleri "sonra skor" ile override
  const scoreOverride = useMemo(() => {
    if (mode !== "after" || !lastSim) return {};
    const next = {};
    (lastSim.detay || []).forEach((x) => {
      next[keyOf(x.ad)] = Number(x.skor_sonra);
    });
    return next;
  }, [mode, lastSim]);

const simByMahalle = useMemo(() => {
  const m = {};
  (lastSim?.detay || []).forEach((x) => {
    m[keyOf(x.ad)] = x; // bu mahalleye ait skor_once, skor_sonra, iyilesme_puani vs.
  });
  return m;
}, [lastSim]);

const simKey = useMemo(() => {
  if (!lastSim?.input) return "nosim";
  const i = lastSim.input;
  return `${i.lat}-${i.lon}-${i.radius_m}-${i.tur}-${i.mode}`;
}, [lastSim]);


  const styleFn = useCallback(
    (feature) => {
      const ad = feature?.properties?.ad;
      const baseSkor = Number(feature?.properties?.skor ?? 0);
      const overrideSkor = scoreOverride[keyOf(ad)];
      const skor = Number.isFinite(overrideSkor) ? overrideSkor : baseSkor;

      return { weight: 1, color: "#333", fillOpacity: 0.65, fillColor: colorByScore(skor) };
    },
    [scoreOverride]
  );


  const onEachFeature = useCallback(
  (feature, layer) => {
    const ad = feature?.properties?.ad;
    const baseSkor = Number(feature?.properties?.skor ?? 0);

    const overrideSkor = scoreOverride[keyOf(ad)];
    const skor = Number.isFinite(overrideSkor) ? overrideSkor : baseSkor;

    // ✅ Simülasyon sonucu bu mahallede var mı?
    const detayRow = simByMahalle[keyOf(ad)];

    let popupHtml = `<b>${ad}</b><br/>`;

    if (detayRow) {
      const once =
        mapMode === "tur"
          ? Number(detayRow.skor_once_tur)
          : Number(detayRow.skor_once);

      const sonra =
        mapMode === "tur"
          ? Number(detayRow.skor_sonra_tur)
          : Number(detayRow.skor_sonra);

      const iyilesme = Number(detayRow.iyilesme_puani);

      popupHtml += `
        Önce: <b>${Number.isFinite(once) ? once.toFixed(2) : "-"}</b><br/>
        Sonra: <b>${Number.isFinite(sonra) ? sonra.toFixed(2) : "-"}</b><br/>
        İyileşme: <b>${Number.isFinite(iyilesme) ? iyilesme.toFixed(2) : "-"}</b>
      `;
    } else {
      // ✅ Etkilenmeyen mahallelerde de anlaşılır bir popup göster
      popupHtml += `
        Skor: <b>${skor.toFixed(2)}</b><br/>
        <i>Bu simülasyonda etkilenmedi.</i>
      `;
    }

    
layer.bindPopup(popupHtml);
    layer.on("click", (e) => {
  // ✅ Hem propagation hem default'u kes (MAP click'e gitmesin)
  L.DomEvent.stop(e);

  const { lat, lng } = e.latlng;
  hasInteractedRef.current = true;

  clearOneriler();
  setClicked({ lat, lon: lng });
  runSim(lat, lng);

  // ✅ popup'ı hemen aç
  
});
  },
  [runSim, scoreOverride, clearOneriler, simByMahalle, mapMode]
);

  const runOneriler = useCallback(async () => {
  if (!canSimulate) return;

  try {
    setOnerilerLoading(true);

    const payload = {
      tur,
      radius_m: radius,
      aday_sayisi: Math.max(5, Math.min(100, Number(adaySayisi) || 25)),
      top_n: Math.max(1, Math.min(20, Number(topN) || 5)),
    };

    const headers = { "Content-Type": "application/json" };
    if (authToken) headers.Authorization = `Bearer ${authToken}`;

    const res = await fetch("http://localhost:3001/api/oneriler", {
      method: "POST",
      headers,
      body: JSON.stringify(payload),
    });

    const data = await res.json();
    setOneriler(Array.isArray(data?.oneriler) ? data.oneriler : []);
  } catch (e) {
    console.error("oneriler hata:", e);
    setOneriler([]);
  } finally {
    setOnerilerLoading(false);
  }
}, [canSimulate, tur, radius, adaySayisi, topN, authToken]);

const fetchScenarios = useCallback(async () => {
  if (!authToken) return;

  setScenariosLoading(true);
  setScenariosErr(null);

  try {
    const res = await fetch("http://localhost:3001/api/senaryolar", {
      headers: { Authorization: `Bearer ${authToken}` },
    });

    const data = await res.json();

    if (!res.ok) {
      setScenariosErr(data?.error || res.statusText);
      setScenarios([]);
      return;
    }

    setScenarios(Array.isArray(data?.scenarios) ? data.scenarios : []);
  } catch (e) {
    setScenariosErr("Bağlantı hatası");
    setScenarios([]);
  } finally {
    setScenariosLoading(false);
  }
}, [authToken]);

useEffect(() => {
  if (canSimulate && authToken) fetchScenarios();
}, [canSimulate, authToken, fetchScenarios]);

const applyScenario = useCallback((s) => {
  // state’leri senaryoya göre güncelle
  setTur(String(s.tur));
  setMapMode(String(s.mode));
  setRadius(Number(s.radius_m));

  const lat = Number(s.lat);
  const lon = Number(s.lon);

  setClicked({ lat, lon });
  hasInteractedRef.current = true;

  // Haritayı o noktaya götür
  const map = mapRef.current;
  if (map && Number.isFinite(lat) && Number.isFinite(lon)) {
    map.setView([lat, lon], 13);
  }

  // istersen anında simülasyonu da tekrar koştur (DB’de snapshot var ama canlı sonuç görmek için)
  runSim(lat, lon, s.weights ?? null);
}, [runSim, setMapMode]);


const saveScenario = useCallback(async () => {
  if (!canSimulate) return;
  if (!authToken) {
    alert("Giriş gerekli (token yok).");
    return;
  }
  if (!lastSim?.input) {
    alert("Önce bir simülasyon çalıştır (lastSim yok).");
    return;
  }

  const name = window.prompt("Senaryo adı:", `Senaryo - ${tur} - ${radius}m`);
  if (!name || !name.trim()) return;

  setSaving(true);
  try {
    const body = {
      name: name.trim(),
      lon: Number(clicked.lon),
      lat: Number(clicked.lat),
      radius_m: Number(radius),
      tur: String(tur),
      mode: String(mapMode),

      // backend'de JSONB: weights
      weights: lastSim?.weights ?? null,

      // backend'de JSONB: result_summary
      result_summary: {
        etkilenen_mahalle_sayisi: lastSim?.etkilenen_mahalle_sayisi ?? 0,
        top10: lastSim?.top10 ?? [],
        input: lastSim?.input ?? { lon: clicked.lon, lat: clicked.lat },
      },
    };

    const res = await fetch("http://localhost:3001/api/senaryolar", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${authToken}`,
      },
      body: JSON.stringify(body),
    });

    const data = await res.json();

    if (!res.ok) {
      console.error("save scenario error:", data);
      alert(`Kaydedilemedi: ${data?.error || res.statusText}`);
      return;
    }

    setLastSavedId(data?.scenario?.id ?? null);
    alert(`Kaydedildi ✅ (id=${data?.scenario?.id ?? "-"})`);
    await fetchScenarios();
  } catch (e) {
    console.error(e);
    alert("Kaydedilemedi: bağlantı hatası");
  } finally {
    setSaving(false);
  }
}, [canSimulate, authToken, lastSim, clicked.lat, clicked.lon, radius, tur, mapMode, fetchScenarios]);

 const filteredScenarios = useMemo(() => {
  const q = scenarioQuery.trim().toLocaleLowerCase("tr-TR");

  return (scenarios || []).filter((s) => {
    if (filterTur !== "all" && String(s.tur) !== filterTur) return false;
    if (filterMode !== "all" && String(s.mode) !== filterMode) return false;
    if (filterRadius !== "all" && String(s.radius_m) !== String(filterRadius)) return false;

    if (q) {
      const hay = `${s.name} ${s.tur} ${s.mode} ${s.radius_m}`.toLocaleLowerCase("tr-TR");
      if (!hay.includes(q)) return false;
    }
    return true;
  });
}, [scenarios, scenarioQuery, filterTur, filterMode, filterRadius]);

const openScenarioDetail = useCallback(async (id) => {
  if (!authToken) return;

  setDetailOpenId(id);
  setDetailLoading(true);
  setDetailErr(null);
  setDetailScenario(null);

  try {
    const res = await fetch(`http://localhost:3001/api/senaryolar/${id}`, {
      headers: { Authorization: `Bearer ${authToken}` },
    });
    const data = await res.json();

    if (!res.ok) {
      setDetailErr(data?.error || res.statusText);
      return;
    }
    setDetailScenario(data?.scenario || null);
  } catch (e) {
    setDetailErr("Bağlantı hatası");
  } finally {
    setDetailLoading(false);
  }
}, [authToken]);

const closeScenarioDetail = useCallback(() => {
  setDetailOpenId(null);
  setDetailScenario(null);
  setDetailErr(null);
}, []);

const deleteScenario = useCallback(async (id) => {
  if (!authToken) return;
  const ok = window.confirm("Bu senaryoyu silmek istiyor musun?");
  if (!ok) return;

  try {
    const res = await fetch(`http://localhost:3001/api/senaryolar/${id}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${authToken}` },
    });

    // ✅ JSON dönmeyebilir (204 vs). O yüzden güvenli oku:
    const text = await res.text();
    let data = null;
    try {
      data = text ? JSON.parse(text) : null;
    } catch {
      data = null;
    }

    if (!res.ok) {
      alert(`Silinemedi: ${data?.error || res.statusText}`);
      return;
    }

    await fetchScenarios();
  } catch (e) {
    console.error("deleteScenario fetch hata:", e);
    alert("Silinemedi: bağlantı/parse hatası");
  }
}, [authToken, fetchScenarios]);

const renameScenario = useCallback(async (s) => {
  if (!authToken) return;

  const nextName = window.prompt("Yeni ad:", s.name);
  if (!nextName || !nextName.trim()) return;

  try {
    const res = await fetch(`http://localhost:3001/api/senaryolar/${s.id}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${authToken}`,
      },
      body: JSON.stringify({ name: nextName.trim() }),
    });

    const data = await res.json();
    if (!res.ok) {
      alert(`Güncellenemedi: ${data?.error || res.statusText}`);
      return;
    }
    await fetchScenarios();
  } catch (e) {
    alert("Güncellenemedi: bağlantı hatası");
  }
}, [authToken, fetchScenarios]);

return (
  <div style={{ marginTop: 12 }}>
    {/* ✅ HARİTA KUTUSU */}
    <div
      style={{
        height: 600,
        width: "100%",
        borderRadius: 18,
        overflow: "hidden",
        position: "relative",
        border: "1px solid #e5e7eb",
        boxShadow: "0 10px 24px rgba(0,0,0,0.08)",
        background: "white",
      }}
    >
      <LegendBox />

      {canSimulate && <ToggleBox mode={mode} setMode={setMode} />}
{canSimulate && (
  <div
    style={{
      position: "absolute",
      zIndex: 999,
      right: 16,
      top: 72, // LegendBox sağ üstte, onun altına gelecek
      display: "flex",
      gap: 8,
      pointerEvents: "auto",
    }}
  >
    <button
      onClick={saveScenario}
      disabled={saving || !lastSim}
      style={{
        cursor: saving ? "not-allowed" : "pointer",
        borderRadius: 10,
        padding: "10px 12px",
        border: "1px solid rgba(255,255,255,0.15)",
        background: saving ? "rgba(255,255,255,0.08)" : "rgba(17,24,39,0.92)",
        color: "white",
        fontWeight: 800,
      }}
      title={!lastSim ? "Önce simülasyon çalıştır" : "Senaryoyu kaydet"}
    >
      {saving ? "Kaydediliyor..." : "Senaryoyu Kaydet"}
    </button>

    {lastSavedId && (
      <div
        style={{
          alignSelf: "center",
          padding: "6px 10px",
          borderRadius: 10,
          border: "1px solid rgba(255,255,255,0.12)",
          background: "rgba(0,0,0,0.25)",
          color: "white",
          fontSize: 12,
          opacity: 0.9,
        }}
      >
        Son kayıt: #{lastSavedId}
      </div>
    )}
  </div>
)}
      {canSimulate && (
        <ControlsBox
          tur={tur}
          setTur={setTur}
          radius={radius}
          setRadius={setRadius}
          mapMode={mapMode}
          setMapMode={setMapMode}
        />
      )}

      {canSimulate && (
        <OneriBox
          adaySayisi={adaySayisi}
          setAdaySayisi={setAdaySayisi}
          topN={topN}
          setTopN={setTopN}
          onRun={runOneriler}
          onClear={clearOneriler}
          isLoading={onerilerLoading}
          count={oneriler.length}
        />
      )}

      {canSimulate && lastSim && (
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
                      <td align="right">{once.toFixed(2)}</td>
                      <td align="right">{sonra.toFixed(2)}</td>
                      <td align="right" style={{ fontWeight: 700 }}>
                        {iyilesme.toFixed(2)}
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
      )}

      {/* ✅ KAYDET BUTONU (harita içinde kalsın) */}
      

      <MapContainer
        center={center}
        zoom={11}
        style={{ height: "100%", width: "100%" }}
        whenCreated={(map) => {
          mapRef.current = map;
          map.on("click", (e) => {
            if (!canSimulate) return;

            const { lat, lng } = e.latlng;
            hasInteractedRef.current = true;

            clearOneriler();
            setClicked({ lat, lon: lng });
            runSim(lat, lng);
          });
        }}
      >
        <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution="&copy; OpenStreetMap" />

        {geojson && (
          <GeoJSON key={`${mapMode}-${tur}`} data={geojson} style={styleFn} onEachFeature={onEachFeature} />
        )}

        <Circle center={[clicked.lat, clicked.lon]} radius={radius} pathOptions={{ color: "#4aa3ff", weight: 2, fillOpacity: 0.08 }} />

        <Marker position={[clicked.lat, clicked.lon]}>
          <Popup>
            Seçilen nokta<br />
            {clicked.lat.toFixed(6)}, {clicked.lon.toFixed(6)}
            <br />
            Tür: <b>{tur}</b>
            <br />
            Radius: <b>{radius} m</b>
            <br />
            Harita: <b>{mapMode === "tur" ? "Seçili Tür" : "Genel"}</b>
          </Popup>
        </Marker>

        {oneriler.map((o, idx) => (
          <Marker key={`${o.aday_mahalle}-${o.lat}-${o.lon}-${idx}`} position={[Number(o.lat), Number(o.lon)]}>
            <Popup>
              <b>Öneri Noktası</b>
              <br />
              Aday mahalle: <b>{o.aday_mahalle}</b>
              <br />
              Tür: <b>{tur}</b> / Radius: <b>{radius} m</b>
              <hr />
              Etkilenen: <b>{o.etkilenen_mahalle_sayisi}</b>
              <br />
              Toplam iyileşme: <b>{o.toplam_iyilesme}</b>
              <br />
              Nüfus ağırlıklı: <b>{o.nufus_agirlikli_iyilesme}</b>
              <br />
              Kritikten çıkan: <b>{o.kritikten_cikan}</b>
            </Popup>
          </Marker>
        ))}
      </MapContainer>
    </div>

    {/* ✅ SENARYOLAR HARİTANIN ALTINDA */}
    {canSimulate && (
      <div
        style={{
          marginTop: 12,
          padding: 12,
          borderRadius: 14,
          ...card,
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
          <div style={{ fontWeight: 800 }}>Senaryolar</div>

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
            {/* ✅ Arama + Filtre */}
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
        
        {!scenariosLoading && !scenariosErr && filteredScenarios.length === 0 && (
  <div>Filtreye uygun senaryo yok.</div>
)}

{!scenariosLoading && filteredScenarios.length > 0 && (
  <div
    style={{
      display: "grid",
      gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
      gap: 10,
    }}
  >
    {filteredScenarios.map((s) => (
      <div
        key={s.id}
        style={{
          padding: 12,
          borderRadius: 12,
          border: "1px solid rgba(255,255,255,0.12)",
          background: "rgba(255,255,255,0.06)",
        }}
      >
        {/* Başlık */}
        <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
          <div style={{ fontWeight: 900, fontSize: 14, lineHeight: 1.2 }}>{s.name}</div>
          <div style={{ opacity: 0.7, fontSize: 12 }}>#{s.id}</div>
        </div>

        {/* Özet */}
        <div style={{ opacity: 0.85, fontSize: 12, lineHeight: 1.6, marginTop: 8, marginBottom: 10 }}>
          Tür: <b>{s.tur}</b> | Mode: <b>{s.mode}</b> | Radius: <b>{s.radius_m}</b> m
          <br />
          Konum: {Number(s.lat).toFixed(5)}, {Number(s.lon).toFixed(5)}
        </div>

        {/* Aksiyonlar */}
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
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
    ))}
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
          {JSON.stringify(detailScenario.result_summary ?? {}, null, 2)}
        </pre>
      </div>
    )}
  </div>
)}

      </div>
    )}
  </div>
); 
}