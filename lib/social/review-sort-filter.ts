/**
 * Fase 6 (INSERIES-REVIEWS-COMMENTS-PREMIUM-01) — puramente client-side: opera sobre o
 * array de reviews que a pagina da serie ja buscou (getSeriesReviews), sem nenhuma query
 * nova por troca de ordenacao/filtro.
 */
export type ReviewSortOption = "recent" | "relevant" | "rated" | "liked";
export type ReviewFilterOption = "all" | "spoiler" | "no-spoiler" | "mine";

type SortableReview = {
  rating: number;
  createdAt: Date;
  updatedAt: Date;
  containsSpoiler: boolean;
  userId: string;
  comments: Array<{ id: string }>;
};

export const REVIEW_SORT_OPTIONS: Array<{ value: ReviewSortOption; label: string }> = [
  { value: "recent", label: "Mais recentes" },
  { value: "relevant", label: "Mais relevantes" },
  { value: "rated", label: "Melhor avaliadas" },
  { value: "liked", label: "Mais curtidas" }
];

export const REVIEW_FILTER_OPTIONS: Array<{ value: ReviewFilterOption; label: string }> = [
  { value: "all", label: "Todas" },
  { value: "spoiler", label: "Somente com spoiler" },
  { value: "no-spoiler", label: "Sem spoiler" },
  { value: "mine", label: "Somente minhas" }
];

export function sortReviews<T extends SortableReview>(reviews: T[], sort: ReviewSortOption): T[] {
  const sorted = [...reviews];

  switch (sort) {
    case "recent":
      return sorted.sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
    case "relevant":
      // "Relevante" = quantas pessoas entraram na conversa, um sinal real que so existe
      // porque esta sprint introduziu Comentarios (nao e uma heuristica inventada).
      return sorted.sort((a, b) => b.comments.length - a.comments.length || b.updatedAt.getTime() - a.updatedAt.getTime());
    case "rated":
      return sorted.sort((a, b) => b.rating - a.rating || b.updatedAt.getTime() - a.updatedAt.getTime());
    case "liked":
      // Fase 5 — sem Curtidas no schema (decisao documentada no README): ordenacao estavel
      // por recencia, ate a infraestrutura de curtidas existir de fato.
      return sorted.sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
    default:
      return sorted;
  }
}

export function filterReviews<T extends SortableReview>(reviews: T[], filter: ReviewFilterOption, viewerId?: string): T[] {
  switch (filter) {
    case "all":
      return reviews;
    case "spoiler":
      return reviews.filter((review) => review.containsSpoiler);
    case "no-spoiler":
      return reviews.filter((review) => !review.containsSpoiler);
    case "mine":
      return viewerId ? reviews.filter((review) => review.userId === viewerId) : [];
    default:
      return reviews;
  }
}
