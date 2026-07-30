import Link from "next/link";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { FixedGrid } from "@/components/ui/fixed-grid";
import { PosterImage } from "@/components/media/poster-image";
import { FlameIcon, MessageCircleIcon, StarIcon } from "@/components/ui/icons";
import { getInitials } from "@/lib/utils";
import type { FeaturedReview, TrendingSeriesEntry } from "@/lib/social/feed-discovery";

/**
 * INSERIES-FEED-REDESIGN-01 — "conteudos complementares", sempre abaixo da timeline: Trending
 * (posters, sem competir visualmente com os cards da timeline) e uma unica Review em destaque.
 * Nunca renderiza nada acima da timeline nem empurra ela pra baixo (ver app/feed/page.tsx).
 */
export function FeedDiscoveryPanel({
  trending,
  featuredReview
}: {
  trending: TrendingSeriesEntry[];
  featuredReview: FeaturedReview | null;
}) {
  if (!trending.length && !featuredReview) return null;

  return (
    <section className="space-y-6">
      {trending.length ? (
        <div className="space-y-3">
          <h2 className="flex items-center gap-2 text-lg font-semibold text-ink">
            <FlameIcon className="h-5 w-5 text-subtle" /> Trending entre usuarios
          </h2>
          <FixedGrid mobile={3} tablet={4} desktop={6}>
            {trending.map((series) => (
              <Link key={series.id} href={`/series/${series.slug}`} className="group space-y-1.5">
                <div className="relative aspect-[2/3] overflow-hidden rounded-2xl transition duration-200 ease-out group-hover:-translate-y-1 group-hover:shadow-raised">
                  <PosterImage src={series.posterUrl} alt={series.title} sizes="160px" />
                </div>
                <p className="truncate text-xs font-medium text-ink">{series.title}</p>
              </Link>
            ))}
          </FixedGrid>
        </div>
      ) : null}

      {featuredReview ? (
        <div className="space-y-3">
          <h2 className="flex items-center gap-2 text-lg font-semibold text-ink">
            <StarIcon className="h-5 w-5 text-subtle" /> Review em destaque
          </h2>
          <Card className="space-y-2 transition duration-200 ease-out hover:-translate-y-1 hover:shadow-raised">
            <div className="flex items-center justify-between gap-2">
              <Link href={`/profile/${featuredReview.user.username}`} className="flex items-center gap-2 text-sm font-semibold text-ink">
                <Avatar label={getInitials(featuredReview.user.name)} name={featuredReview.user.name} src={featuredReview.user.avatarUrl} size="sm" />
                {featuredReview.user.name}
              </Link>
              <Badge variant="warning">
                <StarIcon className="h-3 w-3 fill-current" /> {featuredReview.rating}/5
              </Badge>
            </div>
            <Link href={`/series/${featuredReview.series.slug}#reviews`} className="text-sm font-medium text-primary hover:underline">
              {featuredReview.series.title}
            </Link>
            <p className="line-clamp-3 text-sm text-muted">{featuredReview.body}</p>
            <div className="flex items-center justify-between gap-2">
              {featuredReview.commentCount > 0 ? (
                <Badge variant="secondary">
                  <MessageCircleIcon className="h-3 w-3" /> {featuredReview.commentCount}
                </Badge>
              ) : (
                <span />
              )}
              <Link href={`/series/${featuredReview.series.slug}#reviews`} className="text-xs font-semibold text-primary hover:underline">
                Ler review
              </Link>
            </div>
          </Card>
        </div>
      ) : null}
    </section>
  );
}
