import Link from "next/link";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar } from "@/components/ui/avatar";
import { EmptyState } from "@/components/ui/empty-state";
import { FilmIcon, StarIcon } from "@/components/ui/icons";
import { formatRelativeDate, getInitials } from "@/lib/utils";

type SeriesReview = {
  id: string;
  rating: number;
  body: string;
  visibility: string;
  userId: string;
  createdAt: Date;
  user: { username: string; name: string; avatarUrl: string | null };
};

/**
 * Fase 8 (INSERIES-SERIES-PAGE-PREMIUM-01) — nota media e quantidade sao derivadas do mesmo
 * array `reviews` que a pagina ja busca via `getSeriesReviews` (lib/social/reviews.ts,
 * inalterado) — nenhuma query nova. "Curtir"/"Responder" nao tem suporte no schema (`Review`
 * nao tem contagem de likes nem relacao de resposta) e o ticket pede explicitamente para
 * so "preparar arquitetura" para respostas em thread, nunca implementar de fato, e para
 * nunca alterar a regra de review existente — entao nenhum botao funcional foi adicionado
 * (ver README, secao Reviews, para a limitacao documentada).
 */
export function ReviewsSection({ reviews, viewerId }: { reviews: SeriesReview[]; viewerId?: string }) {
  const averageRating = reviews.length ? reviews.reduce((sum, review) => sum + review.rating, 0) / reviews.length : 0;

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

      {reviews.length ? (
        <div className="space-y-3">
          {reviews.map((review) => (
            <Card
              key={review.id}
              className="space-y-2 transition duration-200 ease-out hover:-translate-y-1 hover:border-border-strong hover:shadow-raised"
            >
              <div className="flex items-center justify-between gap-2">
                <Link href={`/profile/${review.user.username}`} className="flex items-center gap-2.5 font-semibold text-ink">
                  <Avatar label={getInitials(review.user.name)} name={review.user.name} src={review.user.avatarUrl} size="sm" />
                  @{review.user.username}
                </Link>
                <div className="flex items-center gap-2">
                  <Badge variant="warning">
                    <StarIcon className="h-3 w-3 fill-current" /> {review.rating}/5
                  </Badge>
                  <span className="text-xs text-subtle">{formatRelativeDate(review.createdAt)}</span>
                </div>
              </div>
              <p className="text-sm text-muted">{review.body}</p>
              {viewerId && review.userId === viewerId && review.visibility !== "PUBLIC" ? <Badge variant="default">Somente voce</Badge> : null}
            </Card>
          ))}
        </div>
      ) : (
        <EmptyState title="Nenhuma review ainda" copy="Seja o primeiro a avaliar esta serie." />
      )}
    </section>
  );
}
