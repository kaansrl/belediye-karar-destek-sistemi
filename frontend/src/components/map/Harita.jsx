import { useEffect, useMemo, useState, useCallback, useRef } from "react";
import { MapContainer, TileLayer, GeoJSON, Marker, Popup, Circle } from "react-leaflet";
import { LegendBox, ToggleBox, ControlsBox, OneriBox, card } from "./overlays/MapOverlays";
import applyLeafletIconFix from "./leafletIconFix";
import SimSummaryBox from "./SimSummaryBox";
import ScenarioPanel from "./ScenarioPanel";
import useScenarios from "./useScenarios";
import useSimulation from "./useSimulation";

export default function Harita({ onSimResult, mapMode, setMapMode, authToken, role, onSaveScenario }) {
useEffect(() => {
  applyLeafletIconFix();
}, []);

  const mapRef = useRef(null);
  const [geojson, setGeojson] = useState(null);

  const [clicked, setClicked] = useState({ lat: 38.33, lon: 38.30 });
  const [tur, setTur] = useState("okul");
  const [radius, setRadius] = useState(5000);
  const [altTur, setAltTur] = useState("");
const [saving, setSaving] = useState(false);
const [lastSavedId, setLastSavedId] = useState(null);

  // ✅ Öneriler (Akademik)
  const [adaySayisi, setAdaySayisi] = useState(25);
  const [topN, setTopN] = useState(5);
  const [oneriler, setOneriler] = useState([]); // [{aday_mahalle, lon, lat, ...}]
  const [onerilerLoading, setOnerilerLoading] = useState(false);

  const center = useMemo(() => [38.33, 38.30], []);
  const canSimulate = role === "analyst" || role === "admin";
  const scenariosUI = useScenarios({ authToken, canSimulate });
  const fetchScenarios = scenariosUI.fetchScenarios;

  // ✅ GeoJSON fetch: mapMode/tur değişince renk kaynağı değişsin
  // ✅ GeoJSON fetch: mapMode / tur / altTur değişince harita yeniden gelsin
useEffect(() => {
  const controller = new AbortController();

   setGeojson(null);

  const url =
    mapMode === "tur"
      ? `http://127.0.0.1:3001/api/mahalleler/geojson?mode=tur&tur=${encodeURIComponent(tur)}&alt_tur=${encodeURIComponent(altTur || "")}`
      : `http://127.0.0.1:3001/api/mahalleler/geojson`;

  fetch(url, {
    cache: "no-store",
    signal: controller.signal,
  })
    .then(async (r) => {
      const text = await r.text();
      let data = null;

      try {
        data = text ? JSON.parse(text) : null;
      } catch (err) {
        console.error("JSON parse hata:", err);
      }

      return data;
    })
    .then((data) => {
      if (controller.signal.aborted) return;

      if (data?.type === "FeatureCollection") {
        setGeojson(data);
      } else {
        console.error("Geçersiz GeoJSON:", data);
        setGeojson(null);
      }
    })
    .catch((e) => {
      if (e.name !== "AbortError") {
        console.error("GeoJSON fetch hata:", e);
      }
    });

  return () => controller.abort();
}, [mapMode, tur, altTur]);


  const clearOneriler = useCallback(() => {
    setOneriler([]);
  }, []);

  useEffect(() => {
  sim.markInteracted();
  clearOneriler();
}, [altTur]);

  const sim = useSimulation({
  canSimulate,
  authToken,
  onSimResult,
  radius,
  tur,
  mapMode,
  clicked,
  setClicked,
  clearOneriler,
  altTur   
});

  const runOneriler = useCallback(async () => {
  if (!canSimulate) return;

  try {
    setOnerilerLoading(true);

    const payload = {
  tur,
  radius_m: radius,
  aday_sayisi: Math.max(5, Math.min(100, Number(adaySayisi) || 25)),
  top_n: Math.max(1, Math.min(20, Number(topN) || 5)),
  alt_tur: altTur || null,
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
}, [canSimulate, tur, radius, adaySayisi, topN, authToken, altTur]);

const applyScenario = useCallback((s) => {
  setTur(String(s.tur));
  setMapMode(String(s.mode));
  setRadius(Number(s.radius_m));
  setAltTur(s.alt_tur || "");

  const lat = Number(s.lat);
  const lon = Number(s.lon);

  setClicked({ lat, lon });

  const map = mapRef.current;
  if (map && Number.isFinite(lat) && Number.isFinite(lon)) {
    map.setView([lat, lon], 13);
  }

  sim.markInteracted();
  sim.runSim(lat, lon, s.weights ?? null);
}, [sim.runSim, sim.markInteracted, setMapMode]);


const saveScenario = useCallback(async () => {
  if (!canSimulate) return;
  if (!authToken) {
    alert("Giriş gerekli (token yok).");
    return;
  }
  if (!sim.lastSim?.input) {
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
      alt_tur: altTur || null,

      // backend'de JSONB: weights
      weights: sim.lastSim?.weights ?? null,

      // backend'de JSONB: result_summary
      result_summary: {
        etkilenen_mahalle_sayisi: sim.lastSim?.etkilenen_mahalle_sayisi ?? 0,
        top10: sim.lastSim?.top10 ?? [],
        input: sim.lastSim?.input ?? { lon: clicked.lon, lat: clicked.lat },
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
}, [canSimulate, authToken, sim.lastSim, clicked.lat, clicked.lon, radius, tur, mapMode, fetchScenarios]);

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

      {canSimulate && <ToggleBox mode={sim.mode} setMode={sim.setMode} />}
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
  altTur={altTur}
  setAltTur={setAltTur}
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
{canSimulate && <SimSummaryBox lastSim={sim.lastSim} mapMode={mapMode} />}
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
  sim.handleMapClick(lat, lng);
});
        }}
      >
        <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution="&copy; OpenStreetMap" />

        {geojson && (
          <GeoJSON key={`${mapMode}-${tur}-${altTur || "none"}`} data={geojson} style={sim.styleFn} onEachFeature={sim.onEachFeature} />
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

    {canSimulate && (
  <ScenarioPanel
  card={card}
  scenarios={scenariosUI.scenarios}
  scenariosLoading={scenariosUI.scenariosLoading}
  scenariosErr={scenariosUI.scenariosErr}
  scenarioQuery={scenariosUI.scenarioQuery}
  setScenarioQuery={scenariosUI.setScenarioQuery}
  filterTur={scenariosUI.filterTur}
  setFilterTur={scenariosUI.setFilterTur}
  filterMode={scenariosUI.filterMode}
  setFilterMode={scenariosUI.setFilterMode}
  filterRadius={scenariosUI.filterRadius}
  setFilterRadius={scenariosUI.setFilterRadius}
  filteredScenarios={scenariosUI.filteredScenarios}
  fetchScenarios={scenariosUI.fetchScenarios}
  applyScenario={applyScenario}
  openScenarioDetail={scenariosUI.openScenarioDetail}
  renameScenario={scenariosUI.renameScenario}
  deleteScenario={scenariosUI.deleteScenario}
  detailOpenId={scenariosUI.detailOpenId}
  closeScenarioDetail={scenariosUI.closeScenarioDetail}
  detailLoading={scenariosUI.detailLoading}
  detailErr={scenariosUI.detailErr}
  detailScenario={scenariosUI.detailScenario}

  // ✅ N'li compare props
  compareIds={scenariosUI.compareIds}
  setCompareIds={scenariosUI.setCompareIds}
  baselineId={scenariosUI.baselineId}
  setBaselineId={scenariosUI.setBaselineId}

  compareLoading={scenariosUI.compareLoading}
  compareErr={scenariosUI.compareErr}
  compareResult={scenariosUI.compareResult}
  runCompare={scenariosUI.runCompare}
  setCompareResult={scenariosUI.setCompareResult}
  setCompareErr={scenariosUI.setCompareErr}

  onSaveScenario={saveScenario}
/>
)}
  </div>
); 
}