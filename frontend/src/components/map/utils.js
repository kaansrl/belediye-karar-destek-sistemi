// src/components/map/utils.js

export const keyOf = (s) =>
  String(s ?? "")
    .trim()
    .toLocaleLowerCase("tr-TR")
    .replace(/\s+/g, " ")
    .replace(/[’'`´]/g, "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "");

// ✅ 5 kademeli renk (0 iyi → 100 kötü)
export function colorByScore(skor) {
  if (skor >= 80) return "#800026";
  if (skor >= 60) return "#e31a1c";
  if (skor >= 40) return "#fd8d3c";
  if (skor >= 20) return "#fff7bc";
  return "#31a354";
}