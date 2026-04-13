import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import L from "leaflet";
import { keyOf, colorByScore } from "./utils";

export default function useSimulation({
  canSimulate,
  authToken,
  onSimResult,
  radius,
  tur,
  mapMode,
  clicked,
  setClicked,
  clearOneriler,
  altTur,
}) {
  const [lastSim, setLastSim] = useState(null);
  const [mode, setMode] = useState("once");

  const debounceRef = useRef(null);
  const hasInteractedRef = useRef(false);
  const simReqIdRef = useRef(0);

  // ✅ dışarıdan da "interacted" işaretleyebilmek için
  const markInteracted = useCallback(() => {
    hasInteractedRef.current = true;
  }, []);

  // ✅ ASIL FONKSİYON: ÖNCE runSim tanımlı olmalı
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
  alt_tur: altTur || null,
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

      // ✅ eski istek geldiyse çöpe at
      if (reqId !== simReqIdRef.current) return;

      setLastSim(data);
      onSimResult?.(data);
      setMode("after");
    },
    [canSimulate, radius, tur, mapMode, altTur, authToken, onSimResult]
  );

  // ✅ Harita click handler (artık runSim yukarıda olduğu için hata yok)
  const handleMapClick = useCallback(
    (lat, lng, weightsOverride = null) => {
      if (!canSimulate) return;

      hasInteractedRef.current = true; // veya markInteracted()
      clearOneriler?.();
      setClicked({ lat, lon: lng });
      runSim(lat, lng, weightsOverride);
    },
    [canSimulate, clearOneriler, setClicked, runSim]
  );

  // ✅ yetki yoksa reset
  useEffect(() => {
    if (!canSimulate) {
      setLastSim(null);
      setMode("once");
      onSimResult?.(null);
    }
  }, [canSimulate, onSimResult]);

  // ✅ tur/mapMode değişince sim reset
 // ✅ tur / altTur / mapMode değişince sim reset
useEffect(() => {
  simReqIdRef.current += 1; // eski istekleri geçersiz yap
  hasInteractedRef.current = false; // otomatik re-run'ı kes
  setMode("once");
  setLastSim(null);
  onSimResult?.(null);
}, [mapMode, tur, altTur, onSimResult]);

  // ✅ Radius/tur/mapMode değişince simülasyonu yeniden çalıştır (debounce)
  useEffect(() => {
    if (!canSimulate) return;
    if (!hasInteractedRef.current) return;

    clearOneriler?.();

    if (debounceRef.current) clearTimeout(debounceRef.current);

    debounceRef.current = setTimeout(() => {
      runSim(clicked.lat, clicked.lon);
    }, 300);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [canSimulate, radius, clicked.lat, clicked.lon, runSim, clearOneriler]);

  // ✅ mode=after iken sadece etkilenen mahalleleri "sonra skor" ile override
  const scoreOverride = useMemo(() => {
  if (mode !== "after" || !lastSim) return {};
  const next = {};
  (lastSim.detay || []).forEach((x) => {
    const key = keyOf(x.ad);
    const v =
      mapMode === "tur"
        ? Number(x.skor_sonra_tur)
        : Number(x.skor_sonra);

    next[key] = v;
  });
  return next;
}, [mode, lastSim, mapMode]);

  const simByMahalle = useMemo(() => {
    const m = {};
    (lastSim?.detay || []).forEach((x) => {
      m[keyOf(x.ad)] = x;
    });
    return m;
  }, [lastSim]);

  const styleFn = useCallback((feature) => {
  const ad = feature?.properties?.ad;
  const baseSkor = Number(feature?.properties?.skor);
  const overrideSkor = scoreOverride[keyOf(ad)];
  const skor = Number.isFinite(overrideSkor) ? overrideSkor : baseSkor;

  if (keyOf(ad) === keyOf("Atalar Mahallesi")) {
    console.log("[Atalar] base:", baseSkor, "override:", overrideSkor, "final:", skor, "color:", colorByScore(skor));
  }

  return {
    weight: 1,
    color: "#333",
    fillOpacity: 0.65,
    fillColor: colorByScore(skor),
  };
}, [scoreOverride]);

  const onEachFeature = useCallback(
  (feature, layer) => {
    // Sadece tıklama davranışı
    layer.on("click", (e) => {
      L.DomEvent.stop(e);

      const { lat, lng } = e.latlng;
      handleMapClick(lat, lng);
    });
  },
  [handleMapClick]
);

  return {
    lastSim,
    mode,
    setMode,
    runSim,
    markInteracted,
    handleMapClick,

    styleFn,
    onEachFeature,
  };
}