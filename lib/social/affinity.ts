import { prisma } from "@/lib/db/prisma";
import { getBlockedEitherWayIds } from "@/lib/social/block";
import { getMutedIds } from "@/lib/social/mute";

// Fase 18 (INSERIES-SOCIAL-NETWORK-EXPERIENCE-01) — pesos declarados no ticket; simplificados
// pra 3 sinais que o banco ja modela bem sem migrations extras (favoritos/listas-em-comum nao
// tem uma tabela dedicada de "favoritos" hoje — ver README, limitacao documentada). Pesos
// redistribuidos proporcionalmente entre os 3 sinais restantes.
const WEIGHT_COMMON_SERIES = 0.55;
const WEIGHT_RATING_SIMILARITY = 0.3;
const WEIGHT_GENRE_OVERLAP = 0.15;

// Fase 18 — "dois usuarios com apenas 1 serie em comum nao devem receber 95%": exige uma
// amostra minima antes de calcular qualquer coisa.
const MIN_COMMON_SERIES = 3;

export type AffinityResult = { score: number; commonSeriesCount: number } | { score: null; commonSeriesCount: number };

async function getUserSeriesProfile(userId: string) {
  const [statuses, ratings] = await Promise.all([
    prisma.userSeriesStatus.findMany({
      where: { userId, state: { in: ["WATCHING", "COMPLETED"] } },
      select: { seriesId: true, series: { select: { genres: true } } }
    }),
    prisma.rating.findMany({ where: { userId }, select: { seriesId: true, value: true } })
  ]);

  const genreCounts = new Map<string, number>();
  for (const status of statuses) {
    for (const genre of status.series.genres) {
      genreCounts.set(genre, (genreCounts.get(genre) ?? 0) + 1);
    }
  }
  const topGenres = new Set(Array.from(genreCounts.entries()).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([genre]) => genre));

  return {
    seriesIds: new Set(statuses.map((status) => status.seriesId)),
    ratings: new Map(ratings.map((rating) => [rating.seriesId, rating.value])),
    genres: topGenres
  };
}

function jaccard(a: Set<string>, b: Set<string>) {
  if (!a.size || !b.size) return 0;
  let intersection = 0;
  for (const item of a) if (b.has(item)) intersection += 1;
  const union = a.size + b.size - intersection;
  return union ? intersection / union : 0;
}

/** Compatibilidade normalizada 0-100 entre dois usuarios, ou `score: null` quando faltam dados. */
export async function computeAffinity(userIdA: string, userIdB: string): Promise<AffinityResult> {
  const [profileA, profileB] = await Promise.all([getUserSeriesProfile(userIdA), getUserSeriesProfile(userIdB)]);

  let commonSeriesCount = 0;
  for (const seriesId of profileA.seriesIds) if (profileB.seriesIds.has(seriesId)) commonSeriesCount += 1;

  if (commonSeriesCount < MIN_COMMON_SERIES) {
    return { score: null, commonSeriesCount };
  }

  const smallerLibrary = Math.min(profileA.seriesIds.size, profileB.seriesIds.size) || 1;
  const commonSeriesNorm = Math.min(1, commonSeriesCount / smallerLibrary);

  let ratingDiffSum = 0;
  let ratingPairs = 0;
  for (const [seriesId, valueA] of profileA.ratings) {
    const valueB = profileB.ratings.get(seriesId);
    if (valueB === undefined) continue;
    ratingDiffSum += Math.abs(valueA - valueB);
    ratingPairs += 1;
  }
  // Sem pares avaliados em comum: nao penaliza nem beneficia, usa neutro (0.5).
  const ratingSimilarity = ratingPairs > 0 ? 1 - Math.min(1, ratingDiffSum / ratingPairs / 4) : 0.5;

  const genreOverlap = jaccard(profileA.genres, profileB.genres);

  const raw =
    commonSeriesNorm * WEIGHT_COMMON_SERIES + ratingSimilarity * WEIGHT_RATING_SIMILARITY + genreOverlap * WEIGHT_GENRE_OVERLAP;

  return { score: Math.round(raw * 100), commonSeriesCount };
}

export type SuggestedUser = {
  id: string;
  name: string;
  username: string;
  avatarUrl: string | null;
  affinityScore: number | null;
  commonSeriesCount: number;
};

/**
 * Fase 17 — sugestoes por afinidade: candidatos sao usuarios com pelo menos 1 serie em comum
 * (WATCHING/COMPLETED), ja excluindo quem o usuario segue, bloqueou ou foi bloqueado por,
 * ordenados por score desc (so quem tem dados suficientes entra no ranking por score; o resto
 * fica de fora da lista de sugestoes por afinidade — Explorar pessoas ainda mostra usuarios
 * populares/ativos separadamente pra quem tem poucos dados).
 */
export async function suggestUsersByAffinity(userId: string, limit = 12): Promise<SuggestedUser[]> {
  const [following, blocked, muted, viewerStatuses] = await Promise.all([
    prisma.follow.findMany({ where: { followerId: userId }, select: { followingId: true } }),
    getBlockedEitherWayIds(userId),
    getMutedIds(userId),
    prisma.userSeriesStatus.findMany({ where: { userId, state: { in: ["WATCHING", "COMPLETED"] } }, select: { seriesId: true } })
  ]);

  const excludeIds = new Set([userId, ...following.map((row) => row.followingId), ...blocked, ...muted]);
  const seriesIds = viewerStatuses.map((row) => row.seriesId);
  if (!seriesIds.length) return [];

  const candidates = await prisma.userSeriesStatus.groupBy({
    by: ["userId"],
    where: { seriesId: { in: seriesIds }, state: { in: ["WATCHING", "COMPLETED"] }, userId: { notIn: Array.from(excludeIds) } },
    _count: { seriesId: true },
    orderBy: { _count: { seriesId: "desc" } },
    take: 30
  });

  const users = await prisma.user.findMany({
    where: { id: { in: candidates.map((candidate) => candidate.userId) } },
    select: { id: true, name: true, username: true, avatarUrl: true }
  });
  const userMap = new Map(users.map((user) => [user.id, user]));

  const results = await Promise.all(
    candidates.map(async (candidate) => {
      const user = userMap.get(candidate.userId);
      if (!user) return null;
      const affinity = await computeAffinity(userId, candidate.userId);
      return { ...user, affinityScore: affinity.score, commonSeriesCount: affinity.commonSeriesCount };
    })
  );

  return results
    .filter((row): row is SuggestedUser => row !== null)
    .sort((a, b) => (b.affinityScore ?? -1) - (a.affinityScore ?? -1) || b.commonSeriesCount - a.commonSeriesCount)
    .slice(0, limit);
}

/** Fase 15/16 — busca por nome/username, excluindo bloqueios nos dois sentidos. */
export async function searchUsers(viewerId: string | null, q: string, limit = 20) {
  const trimmed = q.trim();
  if (!trimmed) return [];

  const blockedIds = viewerId ? await getBlockedEitherWayIds(viewerId) : [];

  const users = await prisma.user.findMany({
    where: {
      id: viewerId ? { not: viewerId, notIn: blockedIds } : undefined,
      OR: [{ name: { contains: trimmed, mode: "insensitive" } }, { username: { contains: trimmed, mode: "insensitive" } }]
    },
    select: { id: true, name: true, username: true, avatarUrl: true },
    orderBy: [{ username: "asc" }],
    take: limit
  });

  // Fase 16 — correspondencia exata de @username primeiro.
  const lowerQuery = trimmed.replace(/^@/, "").toLowerCase();
  return users.sort((a, b) => {
    const aExact = a.username.toLowerCase() === lowerQuery;
    const bExact = b.username.toLowerCase() === lowerQuery;
    if (aExact !== bExact) return aExact ? -1 : 1;
    return 0;
  });
}

const POPULAR_USERS_PAGE_SIZE = 12;
const POPULAR_USERS_CAP = 120;

export type PopularUsersResult = {
  items: Array<{ id: string; name: string; username: string; avatarUrl: string | null }>;
  page: number;
  totalPages: number;
};

/**
 * Fase 15 — "Usuarios ativos": mais atividades publicas recentes, excluindo bloqueios.
 * Paginado (cards compactos em grade em vez de linhas largas) — a busca de grupos e limitada
 * a `POPULAR_USERS_CAP` autores (mais que suficiente pra qualquer pagina real de "ativos") e
 * paginada em memoria, evitando uma segunda query so pra contar grupos distintos.
 */
export async function getPopularUsers(viewerId: string | null, page = 1): Promise<PopularUsersResult> {
  const blockedIds = viewerId ? await getBlockedEitherWayIds(viewerId) : [];

  const grouped = await prisma.activity.groupBy({
    by: ["userId"],
    where: {
      visibility: "PUBLIC",
      userId: viewerId ? { not: viewerId, notIn: blockedIds } : undefined,
      user: { isProfilePrivate: false, showActivity: true }
    },
    _count: { userId: true },
    orderBy: { _count: { userId: "desc" } },
    take: POPULAR_USERS_CAP
  });

  const totalPages = Math.max(1, Math.ceil(grouped.length / POPULAR_USERS_PAGE_SIZE));
  const safePage = Math.min(Math.max(1, page), totalPages);
  const pageRows = grouped.slice((safePage - 1) * POPULAR_USERS_PAGE_SIZE, safePage * POPULAR_USERS_PAGE_SIZE);

  const users = await prisma.user.findMany({
    where: { id: { in: pageRows.map((row) => row.userId) } },
    select: { id: true, name: true, username: true, avatarUrl: true }
  });
  const userMap = new Map(users.map((user) => [user.id, user]));

  const items = pageRows.map((row) => userMap.get(row.userId)).filter((user): user is NonNullable<typeof user> => Boolean(user));
  return { items, page: safePage, totalPages };
}
