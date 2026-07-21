import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { FixedGrid } from "@/components/ui/fixed-grid";
import { PosterImage } from "@/components/media/poster-image";
import { ContinueWatchingCard } from "@/components/continue-watching/continue-watching-card";
import { StarIcon } from "@/components/ui/icons";
import { formatRelativeDate } from "@/lib/utils";
import type { ContinueWatchingResult } from "@/lib/continue-watching";

const FAVORITE_MIN_RATING = 4;

type ProfileReview = {
  id: string;
  rating: number;
  body: string;
  createdAt: Date;
  updatedAt: Date;
  series: { id: string; slug: string; title: string; posterUrl: string | null };
};

type ProfileSeriesTile = {
  id: string;
  slug: string;
  title: string;
  posterUrl: string | null;
};

function PosterTile({ series }: { series: ProfileSeriesTile }) {
  return (
    <Link
      href={`/series/${series.slug}`}
      aria-label={`Abrir ${series.title}`}
      className="group relative block aspect-[2/3] overflow-hidden rounded-2xl border border-border transition duration-200 ease-out hover:-translate-y-1 hover:border-border-strong hover:shadow-raised"
    >
      <PosterImage
        src={series.posterUrl}
        alt={series.title}
        sizes="(min-width: 1024px) 160px, (min-width: 640px) 25vw, 33vw"
        imageClassName="transition duration-300 ease-out group-hover:scale-105"
      />
    </Link>
  );
}

/**
 * Fase 5 (INSERIES-PROFILE-PREMIUM-01) — cada secao reaproveita um componente/servico ja
 * existente: Continue Watching usa o mesmo card do Dashboard (`ContinueWatchingCard`,
 * `lib/continue-watching`) e e exclusivo do dono do perfil — nao ha nenhuma flag de
 * privacidade para "resumir de onde parei" de outra pessoa, e exibir isso a estranhos nao e
 * sancionado por nenhuma regra existente (decisao documentada no README). Favoritas/Concluidas
 * recentemente/Reviews recentes reaproveitam os mesmos arrays que a pagina ja busca
 * (`reviews`, `completedSeries`) — nenhuma query nova, so um recorte/filtro em memoria.
 *
 * Fase 2 (INSERIES-PRODUCT-EXPERIENCE-REVOLUTION-01) — a secao "Watch Next" (dono only) foi
 * removida daqui: duplicava exatamente "Continuar assistindo" logo acima (mesma pergunta "o
 * que assisto agora"), e o /watch-next pra onde ela linkava foi fundido no Dashboard.
 */
export function ProfileCollections({
  isOwner,
  continueWatching,
  canSeeCompleted,
  completedRecent,
  canSeeReviews,
  reviews
}: {
  isOwner: boolean;
  continueWatching: ContinueWatchingResult | null;
  canSeeCompleted: boolean;
  completedRecent: ProfileSeriesTile[];
  canSeeReviews: boolean;
  reviews: ProfileReview[];
}) {
  const favorites = reviews.filter((review) => review.rating >= FAVORITE_MIN_RATING);

  return (
    <div className="space-y-8">
      {isOwner && continueWatching && continueWatching.items.length ? (
        <section className="space-y-3">
          <h2 className="section-title">Continuar assistindo</h2>
          <div className="scrollbar-thin flex gap-4 overflow-x-auto pb-2">
            {continueWatching.items.map((item) => (
              <ContinueWatchingCard key={item.series.id} item={item} />
            ))}
          </div>
        </section>
      ) : null}

      {canSeeReviews && favorites.length ? (
        <section className="space-y-3">
          <h2 className="section-title">Favoritas</h2>
          <FixedGrid mobile={2} tablet={3} desktop={6}>
            {favorites.slice(0, 6).map((review) => (
              <PosterTile key={review.id} series={review.series} />
            ))}
          </FixedGrid>
        </section>
      ) : null}

      {canSeeCompleted && completedRecent.length ? (
        <section className="space-y-3">
          <h2 className="section-title">Concluidas recentemente</h2>
          <FixedGrid mobile={2} tablet={3} desktop={6}>
            {completedRecent.slice(0, 6).map((series) => (
              <PosterTile key={series.id} series={series} />
            ))}
          </FixedGrid>
        </section>
      ) : null}

      {canSeeReviews && reviews.length ? (
        <section className="space-y-3">
          <h2 className="section-title">Reviews recentes</h2>
          <div className="space-y-3">
            {reviews.slice(0, 4).map((review) => (
              <Card
                key={review.id}
                className="space-y-2 transition duration-200 ease-out hover:-translate-y-1 hover:border-border-strong hover:shadow-raised"
              >
                <div className="flex items-center justify-between gap-2">
                  <Link href={`/series/${review.series.slug}`} className="font-semibold text-ink">
                    {review.series.title}
                  </Link>
                  <Badge variant="warning">
                    <StarIcon className="h-3 w-3 fill-current" /> {review.rating}/5
                  </Badge>
                </div>
                <p className="line-clamp-2 text-sm text-muted">{review.body}</p>
                <p className="text-xs text-subtle">{formatRelativeDate(review.updatedAt)}</p>
              </Card>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}
