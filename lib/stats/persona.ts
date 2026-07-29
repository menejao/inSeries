import type { AnalyticsDataset, GenreStats, OverviewStats, StreakStats } from "@/lib/analytics/types";
import type { FunRecords, ViewerPersona } from "@/lib/stats/types";

const PROCEDURAL_GENRES = new Set(["Crime", "Mystery"]);
const CURRENT_YEAR = () => new Date().getUTCFullYear();

/**
 * INSERIES-STATISTICS-ENGINE-01 — "cada visita deve revelar uma descoberta" starts here: a
 * dynamic persona picked from real signals, not a random label. Every rule scores 0..1; the
 * highest-scoring persona wins, ties broken by array order (most specific first, "Cinefilo de
 * Sofa" last as the generic fallback so it only wins when nothing else fits).
 */
const PERSONA_RULES: Array<{
  slug: string;
  emoji: string;
  title: string;
  description: string;
  score: (ctx: { overview: OverviewStats; genres: GenreStats; streaks: StreakStats; records: FunRecords; dataset: AnalyticsDataset }) => number;
}> = [
  {
    slug: "maratonista",
    emoji: "🍿",
    title: "Maratonista Nato",
    description: "Quando voce comeca uma serie, nao para — sessoes longas sao a sua marca registrada.",
    score: ({ records }) => (records.averageEpisodesPerSession ? Math.min(1, records.averageEpisodesPerSession / 6) : 0)
  },
  {
    slug: "detetive",
    emoji: "🕵️",
    title: "Detetive de Series",
    description: "Crime e misterio dominam seu historico — voce nunca resiste a um bom caso pra resolver.",
    score: ({ genres }) => {
      const proceduralShare = genres.ranking
        .filter((stat) => PROCEDURAL_GENRES.has(stat.genre))
        .reduce((sum, stat) => sum + stat.percentage, 0);
      return proceduralShare / 100;
    }
  },
  {
    slug: "cacador-de-lancamentos",
    emoji: "🚀",
    title: "Cacador de Lancamentos",
    description: "Voce esta sempre nas series mais recentes, acompanhando o que acabou de estrear.",
    score: ({ dataset }) => {
      const withYear = dataset.seriesStatuses.filter((s) => s.firstAirYear !== null);
      if (withYear.length === 0) return 0;
      const recent = withYear.filter((s) => (s.firstAirYear as number) >= CURRENT_YEAR() - 1).length;
      return recent / withYear.length;
    }
  },
  {
    slug: "nostalgico",
    emoji: "📼",
    title: "Nostalgico",
    description: "Classicos consagrados tem mais espaco no seu historico do que os lancamentos da vez.",
    score: ({ dataset }) => {
      const withYear = dataset.seriesStatuses.filter((s) => s.firstAirYear !== null);
      if (withYear.length < 3) return 0;
      const old = withYear.filter((s) => (s.firstAirYear as number) <= CURRENT_YEAR() - 10).length;
      return old / withYear.length;
    }
  },
  {
    slug: "finalizador",
    emoji: "🏁",
    title: "Finalizador",
    description: "Quando voce comeca uma serie, voce termina — abandonar nao esta no seu vocabulario.",
    score: ({ overview }) => {
      const decided = overview.seriesCompleted + overview.seriesDropped;
      return decided > 0 ? overview.seriesCompleted / decided : 0;
    }
  },
  {
    slug: "explorador",
    emoji: "🧭",
    title: "Explorador de Generos",
    description: "Seu historico passeia por generos variados — nenhum favorito absoluto te prende por muito tempo.",
    score: ({ genres }) => {
      if (genres.ranking.length < 5) return 0;
      const dominance = genres.topGenre?.percentage ?? 100;
      return Math.min(1, genres.ranking.length / 10) * (1 - dominance / 100);
    }
  },
  {
    slug: "colecionador",
    emoji: "📚",
    title: "Colecionador de Series",
    description: "Sua lista e enorme — voce coleciona series como quem monta uma biblioteca pessoal.",
    score: ({ overview }) => Math.min(1, overview.seriesTracked / 40)
  },
  {
    slug: "viciado-em-cliffhangers",
    emoji: "😱",
    title: "Viciado em Cliffhangers",
    description: "Voce sempre tem varias series em andamento ao mesmo tempo, cada uma parada num gancho.",
    score: ({ overview }) =>
      overview.seriesTracked > 0 ? Math.min(1, (overview.seriesWatching / overview.seriesTracked) * 1.4) : 0
  },
  {
    slug: "noturno",
    emoji: "🌙",
    title: "Corujao das Series",
    description: "A maior parte dos seus episodios acontece depois da meia-noite.",
    score: ({ records, overview }) => (overview.episodesWatched > 0 ? Math.min(1, records.lateNightEpisodes / overview.episodesWatched) : 0)
  },
  {
    slug: "constante",
    emoji: "🔥",
    title: "Voce Nunca Abandona uma Sequencia",
    description: "Sua consistencia e impressionante — series entram e saem, mas a sua rotina de assistir nao para.",
    score: ({ streaks }) => Math.min(1, streaks.longestStreakDays / 20)
  },
  {
    slug: "cinefilo-de-sofa",
    emoji: "🎬",
    title: "Cinefilo de Sofa",
    description: "Equilibrado, curioso e sempre com uma serie rodando — o perfil classico de quem ama uma boa historia.",
    score: () => 0.3
  }
];

export function classifyViewerPersona(ctx: {
  overview: OverviewStats;
  genres: GenreStats;
  streaks: StreakStats;
  records: FunRecords;
  dataset: AnalyticsDataset;
}): ViewerPersona {
  let best = PERSONA_RULES[PERSONA_RULES.length - 1];
  let bestScore = -1;

  for (const rule of PERSONA_RULES) {
    const score = rule.score(ctx);
    if (score > bestScore) {
      bestScore = score;
      best = rule;
    }
  }

  return { slug: best.slug, emoji: best.emoji, title: best.title, description: best.description };
}
