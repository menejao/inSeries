/**
 * Every human-readable "why am I seeing this?" string lives here — the
 * providers only pick *which* reason applies, never compose the copy
 * inline. Keeps phrasing consistent and makes future i18n/copy tweaks a
 * one-file change instead of a hunt through providers/.
 */
export function genreAffinityReason(genre: string, completedCount: number): string {
  if (completedCount > 0) {
    return `Voce concluiu ${completedCount} serie${completedCount === 1 ? "" : "s"} de ${genre}.`;
  }
  return `Porque voce gosta de ${genre}.`;
}

export function similarSeriesReason(seedTitle: string): string {
  return `Semelhante a ${seedTitle}.`;
}

export function popularReason(): string {
  return "Muito popular no catalogo.";
}

export function ratingReason(voteAverage: number): string {
  return `Bem avaliada (nota ${voteAverage.toFixed(1)}/10).`;
}

export function positiveReviewReason(): string {
  return "Baseado nas suas avaliacoes positivas.";
}

export function trendingReason(): string {
  return "Em alta agora (em exibicao).";
}
