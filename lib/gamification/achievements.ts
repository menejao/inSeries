import type { AchievementDefinition } from "@/lib/gamification/types";
import {
  episodesWatched,
  followingCount,
  genreEpisodes,
  hoursWatched,
  listsCreated,
  reviewsWritten,
  seriesCompleted,
  streakDays
} from "@/lib/gamification/milestones";

/**
 * INSERIES-ACHIEVEMENTS-REDESIGN-01 — "as conquistas nao devem ser desbloqueadas
 * rapidamente... os marcos mais importantes devem exigir semanas ou meses de utilizacao":
 * cada trilha (episodios/series/horas/reviews/listas/sequencia) agora vai do trivial ao
 * genuinamente dificil (5000 episodios, 250 series, 5000 horas, 365 dias seguidos), com
 * pontos crescendo junto (10-20 faceis, 30-60 intermediarios, 100+ dificeis, ate 500 nos
 * marcos lendarios) — a curva de nivel (levels.ts) e alimentada por essa progressao, entao
 * "terminar" o album deixa de ser possivel em poucos dias.
 *
 * `lib/gamification/service.ts` upserta este array na tabela `Achievement` por `slug`
 * (idempotente) — mudar um marco aqui nunca exige uma migration.
 */
export const ACHIEVEMENT_DEFINITIONS: AchievementDefinition[] = [
  // ---- Episodios ----
  {
    slug: "first-episode",
    name: "Primeiro Episodio",
    description: "Assista ao seu primeiro episodio.",
    icon: "play",
    category: "WATCHING",
    rarity: "COMMON",
    points: 10,
    hidden: false,
    triggers: ["EPISODE_WATCHED"],
    metric: episodesWatched,
    target: 1,
    unit: "episodios"
  },
  {
    slug: "ten-episodes",
    name: "10 Episodios",
    description: "Assista a 10 episodios.",
    icon: "film",
    category: "WATCHING",
    rarity: "COMMON",
    points: 20,
    hidden: false,
    triggers: ["EPISODE_WATCHED"],
    metric: episodesWatched,
    target: 10,
    unit: "episodios"
  },
  {
    slug: "hundred-episodes",
    name: "100 Episodios",
    description: "Assista a 100 episodios.",
    icon: "film",
    category: "WATCHING",
    rarity: "RARE",
    points: 50,
    hidden: false,
    triggers: ["EPISODE_WATCHED"],
    metric: episodesWatched,
    target: 100,
    unit: "episodios"
  },
  {
    slug: "episodes-500",
    name: "500 Episodios",
    description: "Assista a 500 episodios.",
    icon: "film",
    category: "WATCHING",
    rarity: "EPIC",
    points: 100,
    hidden: false,
    triggers: ["EPISODE_WATCHED"],
    metric: episodesWatched,
    target: 500,
    unit: "episodios"
  },
  {
    slug: "episodes-1000",
    name: "1.000 Episodios",
    description: "Assista a 1.000 episodios.",
    icon: "film",
    category: "WATCHING",
    rarity: "EPIC",
    points: 180,
    hidden: false,
    triggers: ["EPISODE_WATCHED"],
    metric: episodesWatched,
    target: 1000,
    unit: "episodios"
  },
  {
    slug: "episodes-5000",
    name: "5.000 Episodios",
    description: "Assista a 5.000 episodios — uma vida inteira de series.",
    icon: "trophy",
    category: "WATCHING",
    rarity: "LEGENDARY",
    points: 400,
    hidden: false,
    triggers: ["EPISODE_WATCHED"],
    metric: episodesWatched,
    target: 5000,
    unit: "episodios"
  },

  // ---- Series concluidas ----
  {
    slug: "first-series-completed",
    name: "Primeira Serie Concluida",
    description: "Conclua sua primeira serie.",
    icon: "check-circle",
    category: "WATCHING",
    rarity: "COMMON",
    points: 20,
    hidden: false,
    triggers: ["SERIES_COMPLETED"],
    metric: seriesCompleted,
    target: 1,
    unit: "series"
  },
  {
    slug: "complete-10-series",
    name: "Concluir 10 Series",
    description: "Conclua 10 series.",
    icon: "trophy",
    category: "COLLECTION",
    rarity: "RARE",
    points: 60,
    hidden: false,
    triggers: ["SERIES_COMPLETED"],
    metric: seriesCompleted,
    target: 10,
    unit: "series"
  },
  {
    slug: "series-completed-25",
    name: "Concluir 25 Series",
    description: "Conclua 25 series.",
    icon: "trophy",
    category: "COLLECTION",
    rarity: "EPIC",
    points: 100,
    hidden: false,
    triggers: ["SERIES_COMPLETED"],
    metric: seriesCompleted,
    target: 25,
    unit: "series"
  },
  {
    slug: "complete-50-series",
    name: "Concluir 50 Series",
    description: "Conclua 50 series.",
    icon: "trophy",
    category: "COLLECTION",
    rarity: "EPIC",
    points: 150,
    hidden: false,
    triggers: ["SERIES_COMPLETED"],
    metric: seriesCompleted,
    target: 50,
    unit: "series"
  },
  {
    slug: "series-completed-100",
    name: "Concluir 100 Series",
    description: "Conclua 100 series.",
    icon: "trophy",
    category: "COLLECTION",
    rarity: "LEGENDARY",
    points: 250,
    hidden: false,
    triggers: ["SERIES_COMPLETED"],
    metric: seriesCompleted,
    target: 100,
    unit: "series"
  },
  {
    slug: "series-completed-250",
    name: "Concluir 250 Series",
    description: "Conclua 250 series — um catalogo pessoal impressionante.",
    icon: "trophy",
    category: "COLLECTION",
    rarity: "LEGENDARY",
    points: 450,
    hidden: false,
    triggers: ["SERIES_COMPLETED"],
    metric: seriesCompleted,
    target: 250,
    unit: "series"
  },

  // ---- Horas assistidas ----
  {
    slug: "hours-10",
    name: "10 Horas Assistidas",
    description: "Acumule 10 horas assistindo series.",
    icon: "flame",
    category: "WATCHING",
    rarity: "COMMON",
    points: 15,
    hidden: false,
    triggers: ["EPISODE_WATCHED"],
    metric: hoursWatched,
    target: 10,
    unit: "horas"
  },
  {
    slug: "hundred-hours",
    name: "100 Horas Assistidas",
    description: "Acumule 100 horas assistindo series.",
    icon: "trophy",
    category: "WATCHING",
    rarity: "RARE",
    points: 50,
    hidden: false,
    triggers: ["EPISODE_WATCHED"],
    metric: hoursWatched,
    target: 100,
    unit: "horas"
  },
  {
    slug: "hours-500",
    name: "500 Horas Assistidas",
    description: "Acumule 500 horas assistindo series.",
    icon: "trophy",
    category: "WATCHING",
    rarity: "EPIC",
    points: 120,
    hidden: false,
    triggers: ["EPISODE_WATCHED"],
    metric: hoursWatched,
    target: 500,
    unit: "horas"
  },
  {
    slug: "hours-1000",
    name: "1.000 Horas Assistidas",
    description: "Acumule 1.000 horas assistindo series.",
    icon: "trophy",
    category: "WATCHING",
    rarity: "EPIC",
    points: 200,
    hidden: false,
    triggers: ["EPISODE_WATCHED"],
    metric: hoursWatched,
    target: 1000,
    unit: "horas"
  },
  {
    slug: "hours-5000",
    name: "5.000 Horas Assistidas",
    description: "Acumule 5.000 horas assistindo series.",
    icon: "trophy",
    category: "WATCHING",
    rarity: "LEGENDARY",
    points: 400,
    hidden: false,
    triggers: ["EPISODE_WATCHED"],
    metric: hoursWatched,
    target: 5000,
    unit: "horas"
  },

  // ---- Reviews ----
  {
    slug: "first-review",
    name: "Primeira Review",
    description: "Escreva sua primeira review.",
    icon: "star",
    category: "REVIEW",
    rarity: "COMMON",
    points: 10,
    hidden: false,
    triggers: ["REVIEW_CREATED"],
    metric: reviewsWritten,
    target: 1,
    unit: "avaliacoes"
  },
  {
    slug: "reviews-10",
    name: "10 Reviews",
    description: "Escreva 10 reviews.",
    icon: "star",
    category: "REVIEW",
    rarity: "RARE",
    points: 30,
    hidden: false,
    triggers: ["REVIEW_CREATED"],
    metric: reviewsWritten,
    target: 10,
    unit: "avaliacoes"
  },
  {
    slug: "reviews-50",
    name: "50 Reviews",
    description: "Escreva 50 reviews.",
    icon: "star",
    category: "REVIEW",
    rarity: "EPIC",
    points: 80,
    hidden: false,
    triggers: ["REVIEW_CREATED"],
    metric: reviewsWritten,
    target: 50,
    unit: "avaliacoes"
  },
  {
    slug: "reviews-100",
    name: "100 Reviews",
    description: "Escreva 100 reviews.",
    icon: "star",
    category: "REVIEW",
    rarity: "LEGENDARY",
    points: 150,
    hidden: false,
    triggers: ["REVIEW_CREATED"],
    metric: reviewsWritten,
    target: 100,
    unit: "avaliacoes"
  },

  // ---- Listas ----
  {
    slug: "first-list",
    name: "Primeira Lista",
    description: "Crie sua primeira lista.",
    icon: "list",
    category: "COLLECTION",
    rarity: "COMMON",
    points: 10,
    hidden: false,
    triggers: ["LIST_CREATED"],
    metric: listsCreated,
    target: 1,
    unit: "listas"
  },
  {
    slug: "lists-10",
    name: "10 Listas",
    description: "Crie 10 listas.",
    icon: "list",
    category: "COLLECTION",
    rarity: "RARE",
    points: 30,
    hidden: false,
    triggers: ["LIST_CREATED"],
    metric: listsCreated,
    target: 10,
    unit: "listas"
  },
  {
    slug: "lists-25",
    name: "25 Listas",
    description: "Crie 25 listas.",
    icon: "list",
    category: "COLLECTION",
    rarity: "EPIC",
    points: 60,
    hidden: false,
    triggers: ["LIST_CREATED"],
    metric: listsCreated,
    target: 25,
    unit: "listas"
  },

  // ---- Sequencia ----
  {
    slug: "streak-7",
    name: "7 Dias de Sequencia",
    description: "Assista series por 7 dias seguidos.",
    icon: "flame",
    category: "STREAK",
    rarity: "RARE",
    points: 30,
    hidden: false,
    triggers: ["EPISODE_WATCHED"],
    metric: streakDays,
    target: 7,
    unit: "dias"
  },
  {
    slug: "streak-30",
    name: "30 Dias de Sequencia",
    description: "Assista series por 30 dias seguidos.",
    icon: "flame",
    category: "STREAK",
    rarity: "EPIC",
    points: 100,
    hidden: false,
    triggers: ["EPISODE_WATCHED"],
    metric: streakDays,
    target: 30,
    unit: "dias"
  },
  {
    slug: "streak-100",
    name: "100 Dias de Sequencia",
    description: "Assista series por 100 dias seguidos.",
    icon: "flame",
    category: "STREAK",
    rarity: "LEGENDARY",
    points: 250,
    hidden: false,
    triggers: ["EPISODE_WATCHED"],
    metric: streakDays,
    target: 100,
    unit: "dias"
  },
  {
    slug: "streak-365",
    name: "365 Dias de Sequencia",
    description: "Assista series todos os dias por um ano inteiro.",
    icon: "flame",
    category: "STREAK",
    rarity: "LEGENDARY",
    points: 500,
    hidden: false,
    triggers: ["EPISODE_WATCHED"],
    metric: streakDays,
    target: 365,
    unit: "dias"
  },

  // ---- Especiais (genero) ----
  {
    slug: "drama-lover",
    name: "Drama Lover",
    description: "Assista a 10 episodios de series de Drama.",
    icon: "heart",
    category: "SPECIAL",
    rarity: "RARE",
    points: 25,
    hidden: false,
    triggers: ["EPISODE_WATCHED"],
    metric: genreEpisodes("Drama"),
    target: 10,
    unit: "episodios"
  },
  {
    slug: "comedy-lover",
    name: "Comedy Lover",
    description: "Assista a 10 episodios de series de Comedy.",
    icon: "heart",
    category: "SPECIAL",
    rarity: "RARE",
    points: 25,
    hidden: false,
    triggers: ["EPISODE_WATCHED"],
    metric: genreEpisodes("Comedy"),
    target: 10,
    unit: "episodios"
  },
  {
    slug: "scifi-lover",
    name: "Sci-Fi Lover",
    description: "Assista a 10 episodios de series de Sci-Fi.",
    icon: "heart",
    category: "SPECIAL",
    rarity: "RARE",
    points: 25,
    hidden: false,
    triggers: ["EPISODE_WATCHED"],
    metric: genreEpisodes("Sci-Fi"),
    target: 10,
    unit: "episodios"
  },

  // ---- Social ----
  {
    slug: "first-follow",
    name: "Primeiro Follow",
    description: "Siga outro usuario pela primeira vez.",
    icon: "user",
    category: "SOCIAL",
    rarity: "COMMON",
    points: 10,
    hidden: false,
    triggers: ["USER_FOLLOWED"],
    metric: followingCount,
    target: 1,
    unit: "seguindo"
  }
];
