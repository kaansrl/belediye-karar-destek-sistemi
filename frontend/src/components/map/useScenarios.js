import { useCallback, useEffect, useMemo, useState } from "react";

export default function useScenarios({ authToken, canSimulate }) {
  const [scenarios, setScenarios] = useState([]);
  const [scenariosLoading, setScenariosLoading] = useState(false);
  const [scenariosErr, setScenariosErr] = useState(null);

  const [scenarioQuery, setScenarioQuery] = useState("");
  const [filterTur, setFilterTur] = useState("all");
  const [filterMode, setFilterMode] = useState("all");
  const [filterRadius, setFilterRadius] = useState("all");

  const [detailOpenId, setDetailOpenId] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailErr, setDetailErr] = useState(null);
  const [detailScenario, setDetailScenario] = useState(null);

const [compareIds, setCompareIds] = useState([]); // seçili senaryolar
const [baselineId, setBaselineId] = useState(null); // baseline
  const [compareLoading, setCompareLoading] = useState(false);
  const [compareErr, setCompareErr] = useState(null);
  const [compareResult, setCompareResult] = useState(null);

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
    } catch {
      setScenariosErr("Bağlantı hatası");
      setScenarios([]);
    } finally {
      setScenariosLoading(false);
    }
  }, [authToken]);

  useEffect(() => {
    if (canSimulate && authToken) fetchScenarios();
  }, [canSimulate, authToken, fetchScenarios]);

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
    } catch {
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

      const text = await res.text();
      let data = null;
      try { data = text ? JSON.parse(text) : null; } catch {}

      if (!res.ok) {
        alert(`Silinemedi: ${data?.error || res.statusText}`);
        return;
      }

      await fetchScenarios();
    } catch {
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
    } catch {
      alert("Güncellenemedi: bağlantı hatası");
    }
  }, [authToken, fetchScenarios]);

  const runCompare = useCallback(async () => {
  if (!authToken) return;
  if (!compareIds || compareIds.length < 2) return;

  const base = baselineId ?? compareIds[0];

  setCompareLoading(true);
  setCompareErr(null);
  setCompareResult(null);

  try {
    const res = await fetch("http://localhost:3001/api/senaryolar/compare", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${authToken}`,
      },
      body: JSON.stringify({ baseline_id: base, scenario_ids: compareIds }),
    });

    const data = await res.json();
    if (!res.ok) {
      setCompareErr(data?.error || res.statusText);
      return;
    }
    setCompareResult(data);
    console.log("COMPARE RESULT:", data);
  } catch {
    setCompareErr("Bağlantı hatası");
  } finally {
    setCompareLoading(false);
  }
}, [authToken, compareIds, baselineId]);

  return {
    scenarios,
    scenariosLoading,
    scenariosErr,
    fetchScenarios,

    scenarioQuery, setScenarioQuery,
    filterTur, setFilterTur,
    filterMode, setFilterMode,
    filterRadius, setFilterRadius,
    filteredScenarios,

    detailOpenId,
    detailLoading,
    detailErr,
    detailScenario,
    openScenarioDetail,
    closeScenarioDetail,

    compareIds,
setCompareIds,
baselineId,
setBaselineId,
    compareLoading,
    compareErr, setCompareErr,
    compareResult, setCompareResult,
    runCompare,
     
    renameScenario,
    deleteScenario,
  };
}