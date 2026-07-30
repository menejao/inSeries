import type { ActivityFeedItem } from "@/lib/social/activity";

/**
 * INSERIES-FEED-REDESIGN-01 — "filtros rapidos" exatamente como no ticket (Tudo/Assistindo/
 * Concluiu/Reviews/Listas/Seguidores), operando em memoria sobre a pagina de atividades ja
 * carregada (sem query nova por troca de filtro). O antigo dropdown de ordenacao (recentes/
 * relevantes/mais comentados) saiu — com paginacao real por cursor, ordenar so a pagina em
 * memoria deixou de fazer sentido (a lista inteira nao existe mais em memoria de uma vez).
 */
export type FeedFilterOption = "ALL" | "EPISODES" | "COMPLETIONS" | "REVIEWS" | "LISTS" | "FOLLOWS";

export const FEED_FILTER_OPTIONS: Array<{ value: FeedFilterOption; label: string }> = [
  { value: "ALL", label: "Tudo" },
  { value: "EPISODES", label: "Assistindo" },
  { value: "COMPLETIONS", label: "Concluiu" },
  { value: "REVIEWS", label: "Reviews" },
  { value: "LISTS", label: "Listas" },
  { value: "FOLLOWS", label: "Seguidores" }
];

export function filterFeed(activities: ActivityFeedItem[], filter: FeedFilterOption): ActivityFeedItem[] {
  switch (filter) {
    case "ALL":
      return activities;
    case "EPISODES":
      return activities.filter((activity) => activity.type === "EPISODE_WATCHED");
    case "COMPLETIONS":
      return activities.filter((activity) => activity.type === "SERIES_COMPLETED");
    case "REVIEWS":
      return activities.filter((activity) => activity.type === "REVIEW_CREATED");
    case "LISTS":
      return activities.filter((activity) => activity.type === "LIST_CREATED");
    case "FOLLOWS":
      return activities.filter((activity) => activity.type === "USER_FOLLOWED");
    default:
      return activities;
  }
}
