import type { ActivityType } from "@prisma/client";
import type { ActivityFeedItem } from "@/lib/social/activity";

export type ActivityGroup = {
  type: ActivityType;
  count: number;
  /** "Voce assistiu 5 episodios de O Novato" — sempre pronto pra exibir, nunca so um numero. */
  label: string;
  /** "T08E09 ate T08E13" — so quando fizer sentido pro tipo (hoje, so EPISODE_WATCHED). */
  contextLabel: string | null;
  latestCreatedAt: Date;
  href: string | null;
};

function formatEpisodeCode(seasonNumber: number, episodeNumber: number) {
  return `T${String(seasonNumber).padStart(2, "0")}E${String(episodeNumber).padStart(2, "0")}`;
}

/** Chave que decide se duas atividades CONSECUTIVAS (mesmo tipo) pertencem ao mesmo grupo. */
function groupingKey(activity: ActivityFeedItem): string {
  switch (activity.type) {
    case "EPISODE_WATCHED":
    case "SERIES_STATUS_CHANGED":
    case "SERIES_COMPLETED":
    case "REVIEW_CREATED":
      return activity.series?.id ?? "sem-serie";
    case "USER_FOLLOWED":
      return activity.targetUser?.id ?? "sem-alvo";
    case "COMMENT_CREATED":
      return activity.comment?.reviewId ?? "sem-review";
    case "LIST_CREATED":
      return "lista";
  }
}

function buildLabel(type: ActivityType, count: number, sample: ActivityFeedItem): { label: string; contextLabel: string | null; href: string | null } {
  const seriesTitle = sample.series?.title;
  const seriesHref = sample.series ? `/series/${sample.series.slug}` : null;

  switch (type) {
    case "EPISODE_WATCHED":
      return {
        label: `Voce assistiu ${count} episodio${count > 1 ? "s" : ""}${seriesTitle ? ` de ${seriesTitle}` : ""}`,
        contextLabel: null,
        href: seriesHref
      };
    case "SERIES_STATUS_CHANGED":
      return {
        label: count > 1 ? `Voce atualizou o status de ${seriesTitle ?? "uma serie"} ${count} vezes` : `Voce atualizou o status de ${seriesTitle ?? "uma serie"}`,
        contextLabel: null,
        href: seriesHref
      };
    case "SERIES_COMPLETED":
      return { label: `Voce concluiu ${seriesTitle ?? "uma serie"}`, contextLabel: null, href: seriesHref };
    case "REVIEW_CREATED":
      return {
        label: count > 1 ? `Voce escreveu ${count} reviews` : `Voce escreveu uma review${seriesTitle ? ` de ${seriesTitle}` : ""}`,
        contextLabel: null,
        href: seriesHref
      };
    case "LIST_CREATED":
      return { label: `Voce criou ${count} lista${count > 1 ? "s" : ""}`, contextLabel: null, href: "/lists?view=minhas" };
    case "USER_FOLLOWED":
      return {
        label: count > 1 ? `Voce comecou a seguir ${count} pessoas` : `Voce comecou a seguir ${sample.targetUser?.name ?? "alguem"}`,
        contextLabel: null,
        href: sample.targetUser ? `/profile/${sample.targetUser.username}` : null
      };
    case "COMMENT_CREATED":
      return { label: `Voce comentou ${count} vez${count > 1 ? "es" : ""}`, contextLabel: null, href: seriesHref };
  }
}

/**
 * Fase 11 (INSERIES-DASHBOARD-OPERATIONAL-EXPERIENCE-04) — "atividades consecutivas
 * equivalentes devem ser agrupadas... agrupar por usuario, serie, tipo de acao, intervalo de
 * tempo coerente". `activities` ja vem de um so usuario (getRecentActivityForUser) e ja
 * ordenado por `createdAt desc` (mais recente primeiro) - "usuario" e "intervalo de tempo
 * coerente" saem de graca ao so fundir itens CONSECUTIVOS no array (nunca reordena, nunca
 * funde itens que nao estao um do lado do outro na timeline). "Serie"/"tipo de acao" viram
 * `groupingKey` + `activity.type`.
 */
export function groupRecentActivity(activities: ActivityFeedItem[]): ActivityGroup[] {
  const groups: ActivityGroup[] = [];
  let currentKey: string | null = null;
  let currentType: ActivityType | null = null;
  let bucket: ActivityFeedItem[] = [];

  function flush() {
    if (bucket.length === 0 || currentType === null) return;
    const { label, contextLabel, href } = buildLabel(currentType, bucket.length, bucket[0]);
    let finalContext = contextLabel;

    if (currentType === "EPISODE_WATCHED" && bucket.length > 1) {
      const episodes = bucket.map((item) => item.episode).filter((episode): episode is NonNullable<typeof episode> => Boolean(episode));
      if (episodes.length > 1) {
        const sorted = [...episodes].sort((a, b) => a.season.number - b.season.number || a.number - b.number);
        const first = sorted[0];
        const last = sorted[sorted.length - 1];
        finalContext = `${formatEpisodeCode(first.season.number, first.number)} ate ${formatEpisodeCode(last.season.number, last.number)}`;
      }
    }

    groups.push({ type: currentType, count: bucket.length, label, contextLabel: finalContext, latestCreatedAt: bucket[0].createdAt, href });
  }

  for (const activity of activities) {
    const key = groupingKey(activity);
    if (key === currentKey && activity.type === currentType) {
      bucket.push(activity);
    } else {
      flush();
      currentKey = key;
      currentType = activity.type;
      bucket = [activity];
    }
  }
  flush();

  return groups;
}
