"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar } from "@/components/ui/avatar";
import { Select } from "@/components/ui/select";
import { EmptyState } from "@/components/ui/empty-state";
import { CollectionTagList } from "@/components/media/collection-tag-badge";
import { FilmIcon, FlameIcon, MessageCircleIcon, SparklesIcon, StarIcon } from "@/components/ui/icons";
import { formatRelativeDate, getInitials } from "@/lib/utils";
import { CommentSection, type CommentItem } from "@/components/reviews/comment-section";
import {
  REVIEW_FILTER_OPTIONS,
  REVIEW_SORT_OPTIONS,
  filterReviews,
  sortReviews,
  type ReviewFilterOption,
  type ReviewSortOption
} from "@/lib/social/review-sort-filter";

type SeriesReview = {
  id: string;
  rating: number;
  body: string;
  visibility: string;
  containsSpoiler: boolean;
  userId: string;
  createdAt: Date;
  updatedAt: Date;
  user: { username: string; name: string; avatarUrl: string | null };
  comments: CommentItem[];
};

function countThread(comments: CommentItem[]) {
  return comments.reduce((sum, comment) => sum + 1 + comment.replies.length, 0);
}

/**
 * Fase 2/6/8 (INSERIES-REVIEWS-COMMENTS-PREMIUM-01) — cards de review agora trazem avatar,
 * nome, username, data, nota, spoiler, Collection Tags/Discovery/Quality Score da propria
 * serie (ja carregados pela pagina, nenhuma query nova) e o total de comentarios+respostas
 * (aninhados junto com a review por `getSeriesReviews`, ver lib/social/reviews.ts). Ordenacao
 * e filtro (Fase 6) operam sobre o array ja buscado — nenhuma query nova por troca de opcao.
 * "Curtir"/"Responder" no nivel da review (nao do comentario) continuam sem suporte no schema
 * — ver README, secao Curtidas, para a decisao deliberada de nao implementar.
 */
export function ReviewsSection({
  reviews,
  viewerId,
  authenticated,
  seriesQualityScore,
  seriesDiscoveryScore,
  seriesCollectionTags
}: {
  reviews: SeriesReview[];
  viewerId?: string;
  authenticated: boolean;
  seriesQualityScore?: number | null;
  seriesDiscoveryScore?: number | null;
  seriesCollectionTags: string[];
}) {
  const [sort, setSort] = useState<ReviewSortOption>("recent");
  const [filter, setFilter] = useState<ReviewFilterOption>("all");
  const [revealedSpoilers, setRevealedSpoilers] = useState<Set<string>>(new Set());

  const averageRating = reviews.length ? reviews.reduce((sum, review) => sum + review.rating, 0) / reviews.length : 0;
  const visible = useMemo(
    () => sortReviews(filterReviews(reviews, filter, viewerId), sort),
    [reviews, filter, sort, viewerId]
  );

  function toggleSpoiler(id: string) {
    setRevealedSpoilers((current) => {
      const next = new Set(current);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  return (
    <section id="reviews" className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 text-lg font-semibold text-ink">
          <FilmIcon className="h-5 w-5 text-subtle" />
          Reviews
        </h2>
        {reviews.length ? (
          <div className="flex items-center gap-2">
            <Badge variant="warning">
              <StarIcon className="h-3 w-3 fill-current" /> {averageRating.toFixed(1)}/5
            </Badge>
            <span className="text-sm text-muted">
              {reviews.length} avaliacao{reviews.length === 1 ? "" : "es"}
            </span>
          </div>
        ) : null}
      </div>

      {typeof seriesQualityScore === "number" || typeof seriesDiscoveryScore === "number" || seriesCollectionTags.length ? (
        <div className="flex flex-wrap items-center gap-1.5">
          {typeof seriesQualityScore === "number" ? (
            <Badge variant="primary">
              <SparklesIcon className="h-3 w-3" /> {Math.round(seriesQualityScore)}
            </Badge>
          ) : null}
          {typeof seriesDiscoveryScore === "number" ? (
            <Badge variant="secondary">
              <FlameIcon className="h-3 w-3" /> {Math.round(seriesDiscoveryScore)}
            </Badge>
          ) : null}
          <CollectionTagList tags={seriesCollectionTags} limit={4} />
        </div>
      ) : null}

      {reviews.length ? (
        <>
          <div className="flex flex-wrap items-center gap-2">
            <Select value={sort} onChange={(event) => setSort(event.target.value as ReviewSortOption)} aria-label="Ordenar reviews">
              {REVIEW_SORT_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </Select>
            <Select value={filter} onChange={(event) => setFilter(event.target.value as ReviewFilterOption)} aria-label="Filtrar reviews">
              {REVIEW_FILTER_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </Select>
          </div>

          {visible.length ? (
            <div className="space-y-3">
              {visible.map((review) => {
                const isOwn = viewerId === review.userId;
                const spoilerHidden = review.containsSpoiler && !revealedSpoilers.has(review.id);
                const threadCount = countThread(review.comments);

                return (
                  <Card
                    key={review.id}
                    className="space-y-2.5 transition duration-200 ease-out hover:-translate-y-1 hover:border-border-strong hover:shadow-raised"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <Link href={`/profile/${review.user.username}`} className="flex items-center gap-2.5">
                        <Avatar label={getInitials(review.user.name)} name={review.user.name} src={review.user.avatarUrl} size="sm" />
                        <span className="leading-tight">
                          <span className="block font-semibold text-ink">{review.user.name}</span>
                          <span className="block text-xs text-subtle">@{review.user.username}</span>
                        </span>
                      </Link>
                      <div className="flex items-center gap-2">
                        <Badge variant="warning">
                          <StarIcon className="h-3 w-3 fill-current" /> {review.rating}/5
                        </Badge>
                        <span className="text-xs text-subtle">{formatRelativeDate(review.createdAt)}</span>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-1.5">
                      {review.containsSpoiler ? <Badge variant="danger">Contem spoiler</Badge> : null}
                      {isOwn && review.visibility !== "PUBLIC" ? <Badge variant="default">Somente voce</Badge> : null}
                      {threadCount ? (
                        <Badge variant="secondary">
                          <MessageCircleIcon className="h-3 w-3" /> {threadCount}
                        </Badge>
                      ) : null}
                      {isOwn ? (
                        <a href="#review-form" className="text-xs font-semibold text-primary hover:underline">
                          Editar sua review
                        </a>
                      ) : null}
                    </div>

                    {spoilerHidden ? (
                      <button
                        type="button"
                        onClick={() => toggleSpoiler(review.id)}
                        className="text-sm font-semibold text-primary hover:underline"
                      >
                        Esta review contem spoiler. Mostrar mesmo assim?
                      </button>
                    ) : (
                      <p className="text-sm text-muted">{review.body}</p>
                    )}

                    <CommentSection reviewId={review.id} comments={review.comments} viewerId={viewerId} authenticated={authenticated} />
                  </Card>
                );
              })}
            </div>
          ) : (
            <EmptyState title="Nada por aqui" copy="Nenhuma review encontrada para este filtro." />
          )}
        </>
      ) : (
        <EmptyState title="Nenhuma review ainda" copy="Seja o primeiro a avaliar esta serie." />
      )}
    </section>
  );
}
