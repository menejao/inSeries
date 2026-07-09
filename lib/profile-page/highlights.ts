import type { MyListItem } from "@/lib/my-list/types";

export type ProfileHighlight = {
  key: "bestRated" | "biggestMarathon" | "topDiscovery" | "topQuality" | "mostProgress";
  label: string;
  series: MyListItem["series"];
  value: string;
};

function topByNumeric(items: MyListItem[], selector: (item: MyListItem) => number | null | undefined) {
  let best: MyListItem | null = null;
  let bestValue = -Infinity;
  for (const item of items) {
    const value = selector(item);
    if (value === null || value === undefined) continue;
    if (value > bestValue) {
      best = item;
      bestValue = value;
    }
  }
  return best ? { item: best, value: bestValue } : null;
}

/**
 * Fase 6 (INSERIES-PROFILE-PREMIUM-01) — "Destaques": cada um e um max() puro sobre o mesmo
 * array de `MyListItem` que a Fase 3 (medias) e a pagina ja tem em memoria
 * (`getMyListFullForUser`, filtrado por privacidade quando o visitante nao e o dono) —
 * nenhuma query nova. Cada destaque so aparece se houver um candidato real (nunca um card
 * vazio/generico).
 */
export function computeProfileHighlights(items: MyListItem[]): ProfileHighlight[] {
  const highlights: ProfileHighlight[] = [];

  const bestRated = topByNumeric(
    items.filter((item) => item.reviewRating !== null),
    (item) => item.reviewRating
  );
  if (bestRated) {
    highlights.push({ key: "bestRated", label: "Melhor serie avaliada", series: bestRated.item.series, value: `${bestRated.value}/5` });
  }

  const marathonCandidates = items.filter((item) => item.series.collectionTags.includes("Maratona"));
  const biggestMarathon = topByNumeric(marathonCandidates, (item) => item.series.numberOfEpisodes);
  if (biggestMarathon) {
    highlights.push({
      key: "biggestMarathon",
      label: "Maior maratona",
      series: biggestMarathon.item.series,
      value: `${biggestMarathon.value} episodios`
    });
  }

  const topDiscovery = topByNumeric(items, (item) => item.series.discoveryScore);
  if (topDiscovery) {
    highlights.push({ key: "topDiscovery", label: "Maior Discovery Score", series: topDiscovery.item.series, value: `${Math.round(topDiscovery.value)}` });
  }

  const topQuality = topByNumeric(items, (item) => item.series.qualityScore);
  if (topQuality) {
    highlights.push({ key: "topQuality", label: "Maior Quality Score", series: topQuality.item.series, value: `${Math.round(topQuality.value)}` });
  }

  const mostProgress = topByNumeric(items, (item) => item.completionPercent);
  if (mostProgress && mostProgress.value > 0) {
    highlights.push({ key: "mostProgress", label: "Maior progresso", series: mostProgress.item.series, value: `${Math.round(mostProgress.value)}%` });
  }

  return highlights;
}

/** Fase 3 — Discovery/Quality medio nao existem em `UserStats` (lib/analytics); media pura sobre o mesmo array de `MyListItem`, nenhuma query nova. */
export function computeAverageScore(items: MyListItem[], field: "discoveryScore" | "qualityScore"): number | null {
  const values = items.map((item) => item.series[field]).filter((value): value is number => typeof value === "number");
  if (!values.length) return null;
  return Math.round(values.reduce((sum, value) => sum + value, 0) / values.length);
}
