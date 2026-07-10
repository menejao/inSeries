import Link from "next/link";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { FixedGrid } from "@/components/ui/fixed-grid";
import { PosterImage } from "@/components/media/poster-image";
import { FlameIcon, MessageCircleIcon, StarIcon, UserIcon } from "@/components/ui/icons";
import { getInitials } from "@/lib/utils";
import type { ActiveUser, FeaturedReview, RecentDiscussion, TrendingSeriesEntry } from "@/lib/social/feed-discovery";

/**
 * Fase 5 (INSERIES-SOCIAL-FEED-01) — os 4 blocos recebem dados ja derivados (ver
 * lib/social/feed-discovery.ts) do mesmo batch de atividades da lista principal — nenhuma
 * consulta propria, um Server Component simples.
 */
export function FeedDiscoveryPanel({
  trending,
  featuredReviews,
  discussions,
  activeUsers
}: {
  trending: TrendingSeriesEntry[];
  featuredReviews: FeaturedReview[];
  discussions: RecentDiscussion[];
  activeUsers: ActiveUser[];
}) {
  if (!trending.length && !featuredReviews.length && !discussions.length && !activeUsers.length) return null;

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

      {featuredReviews.length || discussions.length ? (
        <div className="grid gap-4 lg:grid-cols-2">
          {featuredReviews.length ? (
            <div className="space-y-3">
              <h2 className="flex items-center gap-2 text-lg font-semibold text-ink">
                <StarIcon className="h-5 w-5 text-subtle" /> Reviews em destaque
              </h2>
              <div className="space-y-3">
                {featuredReviews.map((review) => (
                  <Card key={review.id} className="space-y-1.5 transition duration-200 ease-out hover:-translate-y-1 hover:shadow-raised">
                    <div className="flex items-center justify-between gap-2">
                      <Link href={`/profile/${review.user.username}`} className="flex items-center gap-2 text-sm font-semibold text-ink">
                        <Avatar label={getInitials(review.user.name)} name={review.user.name} src={review.user.avatarUrl} size="sm" />
                        {review.user.name}
                      </Link>
                      <Badge variant="warning">
                        <StarIcon className="h-3 w-3 fill-current" /> {review.rating}/5
                      </Badge>
                    </div>
                    <Link href={`/series/${review.series.slug}#reviews`} className="text-sm font-medium text-primary hover:underline">
                      {review.series.title}
                    </Link>
                    {review.containsSpoiler ? (
                      <p className="text-sm italic text-subtle">Contem spoiler — abra a serie para ler.</p>
                    ) : (
                      <p className="line-clamp-2 text-sm text-muted">{review.body}</p>
                    )}
                    {review.commentCount > 0 ? (
                      <Badge variant="secondary">
                        <MessageCircleIcon className="h-3 w-3" /> {review.commentCount}
                      </Badge>
                    ) : null}
                  </Card>
                ))}
              </div>
            </div>
          ) : null}

          {discussions.length ? (
            <div className="space-y-3">
              <h2 className="flex items-center gap-2 text-lg font-semibold text-ink">
                <MessageCircleIcon className="h-5 w-5 text-subtle" /> Discussoes recentes
              </h2>
              <div className="space-y-3">
                {discussions.map((discussion) => (
                  <Card key={discussion.id} className="space-y-1.5 transition duration-200 ease-out hover:-translate-y-1 hover:shadow-raised">
                    <Link href={`/profile/${discussion.user.username}`} className="flex items-center gap-2 text-sm font-semibold text-ink">
                      <Avatar label={getInitials(discussion.user.name)} name={discussion.user.name} src={discussion.user.avatarUrl} size="sm" />
                      {discussion.user.name}
                    </Link>
                    <p className="line-clamp-2 text-sm text-muted">{discussion.body}</p>
                    {discussion.series ? (
                      <Link href={`/series/${discussion.series.slug}#reviews`} className="text-xs font-semibold text-primary hover:underline">
                        {discussion.series.title}
                      </Link>
                    ) : null}
                  </Card>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      ) : null}

      {activeUsers.length ? (
        <div className="space-y-3">
          <h2 className="flex items-center gap-2 text-lg font-semibold text-ink">
            <UserIcon className="h-5 w-5 text-subtle" /> Usuarios ativos
          </h2>
          <FixedGrid mobile={2} tablet={3} desktop={3}>
            {activeUsers.map((user) => (
              <Link
                key={user.id}
                href={`/profile/${user.username}`}
                className="flex items-center gap-2.5 rounded-2xl border border-border bg-surface/70 p-3 transition duration-200 ease-out hover:-translate-y-1 hover:border-border-strong hover:shadow-raised"
              >
                <Avatar label={getInitials(user.name)} name={user.name} src={user.avatarUrl} size="sm" />
                <span className="min-w-0">
                  <span className="block truncate text-sm font-semibold text-ink">{user.name}</span>
                  <span className="block truncate text-xs text-subtle">{user.activityCount} atividades</span>
                </span>
              </Link>
            ))}
          </FixedGrid>
        </div>
      ) : null}
    </section>
  );
}
