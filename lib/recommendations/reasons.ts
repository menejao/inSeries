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

/** Fase 4 (INSERIES-DASHBOARD-PREMIUM-01) — only ever used when there's a real tag/keyword overlap with the user's own history (never a generic "high score" reason). */
export function editorialReason(matchedTag: string | undefined, matchedKeyword: string | undefined): string {
  if (matchedTag) return `Porque voce assiste series com a marca "${matchedTag}".`;
  if (matchedKeyword) return `Porque voce assiste series sobre "${matchedKeyword}".`;
  return "Selecionado com base no seu historico.";
}

// INSERIES-RECOMMENDATION-ENGINE-02 — new affinity factors, each with its own specific reason
// (never a generic "selected for you" — the ticket explicitly forbids that).
export function creatorReason(creator: string): string {
  return `De ${creator}, criador(a) de series que voce acompanha.`;
}

export function castReason(actor: string): string {
  return `Com ${actor}, do elenco de series que voce assistiu.`;
}

export function networkReason(network: string): string {
  return `Porque voce gosta de series da ${network}.`;
}

export function platformReason(provider: string): string {
  return `Disponivel na ${provider}, onde voce mais assiste.`;
}

export function languageReason(language: string): string {
  return `No idioma que voce mais assiste (${language}).`;
}

export function countryReason(country: string): string {
  return `De um pais que voce costuma assistir (${country}).`;
}

export function discoveryReason(genre: string): string {
  return `Uma descoberta fora do seu genero habitual — ${genre}.`;
}
