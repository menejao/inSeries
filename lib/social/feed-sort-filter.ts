import type { ActivityFeedItem } from "@/lib/social/activity";

/**
 * Fase 4 (INSERIES-SOCIAL-FEED-01) — puramente client-side: opera sobre o array de
 * atividades ja buscado (getGlobalFeed/getPersonalFeed), sem nenhuma query nova por troca de
 * filtro/ordenacao. Mesmo padrao de `lib/social/review-sort-filter.ts`.
 */
export type FeedFilterOption = "ALL" | "REVIEWS" | "COMMENTS" | "SERIES" | "EPISODES" | "COMPLETIONS";
export type FeedSortOption = "recent" | "relevant" | "most-commented";

export const FEED_FILTER_OPTIONS: Array<{ value: FeedFilterOption; label: string }> = [
  { value: "ALL", label: "Tudo" },
  { value: "REVIEWS", label: "Reviews" },
  { value: "COMMENTS", label: "Comentarios" },
  { value: "SERIES", label: "Series" },
  { value: "EPISODES", label: "Episodios" },
  { value: "COMPLETIONS", label: "Conclusoes" }
];

export const FEED_SORT_OPTIONS: Array<{ value: FeedSortOption; label: string }> = [
  { value: "recent", label: "Recentes" },
  { value: "relevant", label: "Relevantes" },
  { value: "most-commented", label: "Mais comentados" }
];

export function filterFeed(activities: ActivityFeedItem[], filter: FeedFilterOption): ActivityFeedItem[] {
  switch (filter) {
    case "ALL":
      return activities;
    case "REVIEWS":
      return activities.filter((activity) => activity.type === "REVIEW_CREATED");
    case "COMMENTS":
      return activities.filter((activity) => activity.type === "COMMENT_CREATED");
    case "SERIES":
      return activities.filter((activity) => activity.type === "SERIES_STATUS_CHANGED");
    case "EPISODES":
      return activities.filter((activity) => activity.type === "EPISODE_WATCHED");
    case "COMPLETIONS":
      return activities.filter((activity) => activity.type === "SERIES_COMPLETED");
    default:
      return activities;
  }
}

/** Sinal de "relevancia": reviews/comentarios (geram conversa) antes de eventos passivos, empatados por recencia. */
const RELEVANCE_WEIGHT: Record<ActivityFeedItem["type"], number> = {
  REVIEW_CREATED: 3,
  COMMENT_CREATED: 3,
  SERIES_COMPLETED: 2,
  LIST_CREATED: 2,
  USER_FOLLOWED: 1,
  SERIES_STATUS_CHANGED: 1,
  EPISODE_WATCHED: 0
};

export function sortFeed(activities: ActivityFeedItem[], sort: FeedSortOption): ActivityFeedItem[] {
  const sorted = [...activities];

  switch (sort) {
    case "recent":
      return sorted.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    case "relevant":
      return sorted.sort(
        (a, b) => RELEVANCE_WEIGHT[b.type] - RELEVANCE_WEIGHT[a.type] || b.createdAt.getTime() - a.createdAt.getTime()
      );
    case "most-commented":
      // Reviews e comentarios carregam a contagem de comentarios da propria review
      // (activity.review._count.comments); qualquer outro tipo de atividade nao tem review
      // associada e vale 0 — cai naturalmente para o fim, ordenado por recencia.
      return sorted.sort(
        (a, b) => (b.review?._count.comments ?? 0) - (a.review?._count.comments ?? 0) || b.createdAt.getTime() - a.createdAt.getTime()
      );
    default:
      return sorted;
  }
}
