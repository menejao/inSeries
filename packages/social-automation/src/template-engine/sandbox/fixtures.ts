/**
 * Fictitious ContentPayloads used by the sandbox script AND by the Vitest suite.
 *
 * They mimic exactly what content-engine/ persists on SocialContent.payload — nothing here calls
 * the database, the network or the Content Engine. Some entries deliberately have holes
 * (null poster, null voteAverage, empty watchProviders, null overview) so the placeholder paths
 * are exercised on every sandbox run.
 */
import type { ContentPayload, SeriesSummary } from "../../content-engine/types";

type SeriesInput = Partial<SeriesSummary> & { id: string; title: string };

export function series(input: SeriesInput): SeriesSummary {
  return {
    slug: input.title.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
    overview: null,
    posterUrl: null,
    backdropUrl: null,
    firstAirYear: null,
    genres: [],
    keywords: [],
    collectionTags: [],
    status: "RETURNING" as SeriesSummary["status"],
    popularityScore: null,
    voteAverage: null,
    voteCount: null,
    discoveryScore: null,
    qualityScore: null,
    watchProviders: [],
    originCountry: [],
    spokenLanguages: [],
    numberOfSeasons: null,
    numberOfEpisodes: null,
    ...input
  };
}

export const breakingBad = series({
  id: "s-breaking-bad",
  title: "Breaking Bad",
  overview:
    "Um professor de quimica com cancer terminal se une a um ex-aluno para produzir metanfetamina e garantir o futuro financeiro da familia.",
  firstAirYear: 2008,
  genres: ["Drama", "Crime", "Suspense"],
  voteAverage: 8.9,
  voteCount: 13420,
  watchProviders: ["Netflix"],
  numberOfSeasons: 5,
  numberOfEpisodes: 62
});

export const dark = series({
  id: "s-dark",
  title: "Dark",
  overview: "O desaparecimento de duas criancas expoe segredos e viagens no tempo entre quatro familias de uma cidade alema.",
  firstAirYear: 2017,
  genres: ["Misterio", "Ficcao Cientifica", "Drama"],
  voteAverage: 8.4,
  voteCount: 5210,
  watchProviders: ["Netflix"]
});

/** Sem poster, sem nota, sem plataforma — exercita TODOS os placeholders. */
export const theBear = series({
  id: "s-the-bear",
  title: "The Bear",
  overview: null,
  firstAirYear: 2022,
  genres: ["Drama", "Comedia"],
  voteAverage: null,
  voteCount: null,
  watchProviders: []
});

export const lioness = series({
  id: "s-lioness",
  title: "Lioness",
  overview: "Uma agente da CIA e recrutada para se infiltrar no circulo intimo de um alvo de alto valor.",
  firstAirYear: 2023,
  genres: ["Acao", "Drama"],
  voteAverage: 7.6,
  voteCount: 890,
  watchProviders: ["Paramount+"]
});

export const theLastOfUs = series({
  id: "s-the-last-of-us",
  title: "The Last of Us",
  overview: "Vinte anos depois do colapso da civilizacao, um contrabandista precisa escoltar uma adolescente pelos Estados Unidos.",
  firstAirYear: 2023,
  genres: ["Drama", "Aventura", "Terror"],
  voteAverage: 8.7,
  voteCount: 6740,
  watchProviders: ["Max"]
});

function payload(input: Partial<ContentPayload> & Pick<ContentPayload, "templateKey" | "title">): ContentPayload {
  return {
    type: "post",
    hook: "",
    sourceSeries: null,
    items: [],
    caption: "",
    cta: { id: "cta-app", text: "Monte sua lista no inSeries" },
    hashtags: ["#inSeries", "#series", "#oqueassistir"],
    requiresApproval: true,
    format: input.templateKey,
    hookId: "hook-01",
    ...input
  };
}

/** One payload per template key — the sandbox renders all of them. */
export const sandboxPayloads: ContentPayload[] = [
  payload({
    templateKey: "series-of-the-day",
    title: "Serie do dia: Breaking Bad",
    hook: "A serie que redefiniu o antiheroi na TV",
    sourceSeries: breakingBad,
    caption: "Breaking Bad e a serie do dia no inSeries. Ja marcou como assistida?",
    cta: { id: "cta-track", text: "Acompanhe seu progresso no inSeries" }
  }),

  payload({
    templateKey: "similar-series",
    title: "Para quem gostou de Dark",
    hook: "Misterio, tempo e cidades pequenas com segredos grandes",
    sourceSeries: dark,
    items: [theLastOfUs, breakingBad, lioness, theBear],
    caption: "Gostou de Dark? Estas quatro series seguram a mesma tensao.",
    extra: { criterion: "similarity" }
  }),

  payload({
    templateKey: "trending",
    title: "Em alta no inSeries esta semana",
    hook: "As series que mais ganharam acompanhamentos nos ultimos 7 dias",
    sourceSeries: theLastOfUs,
    items: [breakingBad, dark, theBear, lioness],
    caption: "O termometro da semana no inSeries.",
    extra: { criterion: "discoveryScore" }
  }),

  payload({
    templateKey: "ranking",
    title: "Top 5 mais concluidas",
    hook: "O ranking da comunidade",
    sourceSeries: breakingBad,
    items: [dark, theLastOfUs, lioness, theBear],
    caption: "As series que a comunidade mais terminou.",
    extra: {
      criterion: "most-completed",
      ranking: [
        { seriesId: "s-breaking-bad", completedCount: 1284 },
        { seriesId: "s-dark", completedCount: 977 },
        { seriesId: "s-the-last-of-us", completedCount: 812 },
        { seriesId: "s-lioness", completedCount: 340 },
        { seriesId: "s-the-bear", completedCount: 298 }
      ]
    }
  }),

  payload({
    templateKey: "poll",
    title: "Qual dessas voce maratonaria hoje?",
    hook: "Escolha uma e conta nos comentarios",
    sourceSeries: theBear,
    items: [dark, lioness],
    caption: "Vota ai: qual entra na lista hoje?",
    cta: { id: "cta-poll", text: "Responda nos comentarios e monte sua lista no inSeries" },
    extra: {
      criterion: "poll",
      question: "Qual dessas voce maratonaria hoje?",
      options: [
        { seriesId: "s-the-bear", label: "The Bear" },
        { seriesId: "s-dark", label: "Dark" },
        { seriesId: "s-lioness", label: "Lioness" }
      ]
    }
  }),

  payload({
    templateKey: "weekly-premieres",
    title: "Estreias da semana",
    hook: "Episodios novos entre segunda e domingo",
    sourceSeries: lioness,
    items: [theBear, theLastOfUs, dark, breakingBad],
    caption: "A agenda da semana ja esta no seu calendario do inSeries.",
    extra: { criterion: "episode-aired-in-window", windowDays: 7 }
  }),

  payload({
    templateKey: "themed-list",
    title: "5 series para quem ama antiherois",
    hook: "Protagonistas que voce torce mesmo sabendo que nao deveria",
    sourceSeries: breakingBad,
    items: [dark, lioness, theBear, theLastOfUs],
    caption: "Lista tematica da semana no inSeries.",
    extra: { criterion: "themed-list", themeKey: "antiherois", themeLabel: "Antiherois" }
  }),

  payload({
    templateKey: "inseries-feature",
    title: "Calendario de episodios",
    hook: "Saiba exatamente quando cada episodio estreia",
    caption: "O calendario do inSeries junta todas as suas series em uma agenda so.",
    cta: { id: "cta-feature", text: "Experimente o calendario no inSeries" },
    extra: {
      criterion: "product-feature",
      featureId: "calendar",
      featureTitle: "Calendario de episodios",
      featureDescription: "Todas as suas series em uma agenda unica, com lembrete do proximo episodio e do que ficou para tras."
    }
  })
];

export function payloadFor(templateKey: string): ContentPayload {
  const found = sandboxPayloads.find((item) => item.templateKey === templateKey);
  if (!found) throw new Error(`fixture ausente para templateKey "${templateKey}"`);
  return found;
}
