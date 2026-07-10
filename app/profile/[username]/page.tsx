import Link from "next/link";
import { notFound } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { FixedGrid } from "@/components/ui/fixed-grid";
import { FollowButton } from "@/components/social/follow-button";
import { buttonVariants } from "@/components/ui/button";
import { EyeOffIcon } from "@/components/ui/icons";
import { ProfileHeader } from "@/components/profile/profile-header";
import { ProfileStatsSection } from "@/components/profile/profile-stats-section";
import { ProfileHighlights } from "@/components/profile/profile-highlights";
import { ProfileCollections } from "@/components/profile/profile-collections";
import { ProfileTimeline } from "@/components/profile/profile-timeline";
import { ReviewsStatsSection } from "@/components/reviews/reviews-stats-section";
import { getCurrentUser } from "@/lib/auth/server";
import {
  getProfileByUsername,
  getPublicListsForUser,
  getPublicReviewsForUser,
  getWatchStateSeries,
  isFollowing
} from "@/lib/social/profile";
import { getProfileActivity } from "@/lib/social/activity";
import { getMostReviewedSeries, getUserReviewStats } from "@/lib/social/review-stats";
import { getUserStats } from "@/lib/analytics";
import { getMyListFullForUser } from "@/lib/my-list";
import { getContinueWatchingForUser } from "@/lib/continue-watching";
import { getWatchNextForUser } from "@/lib/watch-next";
import { computeProfileHighlights } from "@/lib/profile-page/highlights";
import { prisma } from "@/lib/db/prisma";

/**
 * INSERIES-PROFILE-PREMIUM-01 — o Perfil como vitrine da jornada do usuario: cabecalho,
 * estatisticas, destaques, colecoes e timeline, tudo reaproveitando servicos existentes
 * (getUserStats, getMyListFullForUser, getContinueWatchingForUser, getWatchNextForUser,
 * getProfileActivity) e preservando a mesma regra de privacidade granular ja estabelecida
 * (showWatchingSeries/showWatchedSeries/showLists/showReviews/showActivity +
 * isProfilePrivate). Ver README para o audit completo da Fase 1 e as decisoes de
 * privacidade para as secoes novas (Fase 1/2/3/5/6).
 */
export default async function ProfilePage({ params }: { params: Promise<{ username: string }> }) {
  const { username } = await params;
  const profile = await getProfileByUsername(username);

  if (!profile) {
    notFound();
  }

  const viewer = await getCurrentUser();
  const isOwner = viewer?.id === profile.id;
  const viewerFollows = viewer && !isOwner ? await isFollowing(viewer.id, profile.id) : false;

  const hidden = profile.isProfilePrivate && !isOwner;

  const canSeeWatching = isOwner || (!profile.isProfilePrivate && profile.showWatchingSeries);
  const canSeeCompleted = isOwner || (!profile.isProfilePrivate && profile.showWatchedSeries);
  const canSeeLists = isOwner || (!profile.isProfilePrivate && profile.showLists);
  const canSeeReviews = isOwner || (!profile.isProfilePrivate && profile.showReviews);
  const canSeeActivity = isOwner || (!profile.isProfilePrivate && profile.showActivity);
  // Fase 1 (INSERIES-PROFILE-PREMIUM-01) — nao existe uma flag de privacidade dedicada para
  // estatisticas/destaques (estes sao agregados novos, nao cobertos por nenhuma regra
  // existente). Decisao: tratar como uma extensao dos mesmos dois toggles que ja controlam
  // as listas de series equivalentes — se o usuario escondeu as duas, tambem escondemos os
  // agregados derivados delas, em vez de inventar uma flag nova.
  const canSeeStats = isOwner || (!profile.isProfilePrivate && (profile.showWatchingSeries || profile.showWatchedSeries));

  const [watchingSeries, completedSeries, lists, reviews, activity, stats, fullList, continueWatching, watchNext, reviewStats, mostReviewedSeries] =
    await Promise.all([
    canSeeWatching ? getWatchStateSeries(profile.id, "WATCHING") : Promise.resolve([]),
    canSeeCompleted ? getWatchStateSeries(profile.id, "COMPLETED") : Promise.resolve([]),
    canSeeLists
      ? isOwner
        ? prisma.list.findMany({
            where: { userId: profile.id },
            include: { _count: { select: { items: true } } },
            orderBy: { updatedAt: "desc" }
          })
        : getPublicListsForUser(profile.id)
      : Promise.resolve([]),
    canSeeReviews
      ? isOwner
        ? prisma.review.findMany({
            where: { userId: profile.id },
            include: { series: { select: { id: true, slug: true, title: true, posterUrl: true } } },
            orderBy: { updatedAt: "desc" },
            take: 12
          })
        : getPublicReviewsForUser(profile.id)
      : Promise.resolve([]),
    canSeeActivity ? getProfileActivity(profile.id, viewer?.id ?? null, 20) : Promise.resolve([]),
    canSeeStats ? getUserStats(profile.id) : Promise.resolve(null),
    canSeeStats ? getMyListFullForUser(profile.id) : Promise.resolve(null),
    isOwner ? getContinueWatchingForUser(profile.id, { limit: 6 }) : Promise.resolve(null),
    isOwner ? getWatchNextForUser(profile.id, { limit: 6 }) : Promise.resolve(null),
    canSeeReviews ? getUserReviewStats(profile.id) : Promise.resolve(null),
    canSeeReviews ? getMostReviewedSeries() : Promise.resolve(null)
  ]);

  // Fase 1/6 — "Destaques"/medias (Discovery/Quality) usam getMyListFullForUser, que
  // devolve os 5 estados de WatchState sem filtro (foi construido assumindo que quem chama
  // e sempre o dono, para a Minha Lista). Para um visitante, restringimos aos mesmos 2
  // estados que as flags de privacidade ja autorizam — nunca mais do que
  // canSeeWatching/canSeeCompleted ja permitem em qualquer outro lugar do perfil.
  const highlightItems = fullList
    ? isOwner
      ? fullList.items
      : fullList.items.filter((item) => (item.state === "WATCHING" && canSeeWatching) || (item.state === "COMPLETED" && canSeeCompleted))
    : [];
  const highlights = computeProfileHighlights(highlightItems);

  return (
    <div className="space-y-8">
      <ProfileHeader
        profile={profile}
        stats={canSeeStats ? stats : null}
        action={
          isOwner ? (
            <Link href="/settings" className={buttonVariants({ variant: "secondary" })}>
              Editar perfil
            </Link>
          ) : (
            <FollowButton username={profile.username} initialFollowing={viewerFollows} authenticated={Boolean(viewer)} />
          )
        }
      />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Card>
          <p className="text-sm text-muted">Seguidores</p>
          <p className="mt-2 text-3xl font-black text-ink">{profile._count.followers}</p>
        </Card>
        <Card>
          <p className="text-sm text-muted">Seguindo</p>
          <p className="mt-2 text-3xl font-black text-ink">{profile._count.following}</p>
        </Card>
        <Card>
          <p className="text-sm text-muted">Listas</p>
          <p className="mt-2 text-3xl font-black text-ink">{hidden ? "-" : lists.length}</p>
        </Card>
        <Card>
          <p className="text-sm text-muted">Reviews</p>
          <p className="mt-2 text-3xl font-black text-ink">{hidden ? "-" : reviews.length}</p>
        </Card>
      </div>

      {hidden ? (
        <EmptyState
          icon={<EyeOffIcon className="h-6 w-6" />}
          title="Perfil privado"
          copy="Este usuario mantem series, listas e reviews visiveis apenas para si mesmo."
        />
      ) : (
        <>
          {canSeeStats && stats ? <ProfileStatsSection stats={stats} highlightItems={highlightItems} /> : null}

          <ProfileHighlights highlights={highlights} lastActivityAt={canSeeStats ? (stats?.streaks.lastWatchedAt ?? null) : null} />

          <ProfileCollections
            isOwner={isOwner}
            continueWatching={continueWatching}
            watchNext={watchNext}
            canSeeCompleted={canSeeCompleted}
            completedRecent={completedSeries}
            canSeeReviews={canSeeReviews}
            reviews={reviews}
          />

          <section className="space-y-3">
            <h2 className="section-title">Assistindo</h2>
            {canSeeWatching ? (
              watchingSeries.length ? (
                <FixedGrid mobile={1} tablet={2} desktop={3}>
                  {watchingSeries.map((series) => (
                    <Link key={series.id} href={`/series/${series.slug}`}>
                      <Card interactive padding="sm">
                        <p className="font-semibold text-ink">{series.title}</p>
                        <p className="mt-1 text-sm text-muted">{series.firstAirYear ?? "n/d"}</p>
                      </Card>
                    </Link>
                  ))}
                </FixedGrid>
              ) : (
                <EmptyState title="Nada assistindo" copy="Quando este usuario comecar uma serie, ela aparece aqui." />
              )
            ) : (
              <EmptyState icon={<EyeOffIcon className="h-6 w-6" />} title="Oculto" copy="Este usuario optou por nao exibir series assistindo." />
            )}
          </section>

          <section className="space-y-3">
            <h2 className="section-title">Concluidas</h2>
            {canSeeCompleted ? (
              completedSeries.length ? (
                <FixedGrid mobile={1} tablet={2} desktop={3}>
                  {completedSeries.map((series) => (
                    <Link key={series.id} href={`/series/${series.slug}`}>
                      <Card interactive padding="sm">
                        <p className="font-semibold text-ink">{series.title}</p>
                        <p className="mt-1 text-sm text-muted">{series.firstAirYear ?? "n/d"}</p>
                      </Card>
                    </Link>
                  ))}
                </FixedGrid>
              ) : (
                <EmptyState title="Nada concluido" copy="Series concluidas aparecem aqui quando publicas." />
              )
            ) : (
              <EmptyState icon={<EyeOffIcon className="h-6 w-6" />} title="Oculto" copy="Este usuario optou por nao exibir series concluidas." />
            )}
          </section>

          <section className="space-y-3">
            <h2 className="section-title">Listas</h2>
            {canSeeLists ? (
              lists.length ? (
                <FixedGrid mobile={1} tablet={2} desktop={3}>
                  {lists.map((list) => (
                    <Link key={list.id} href={`/lists/${list.id}`}>
                      <Card interactive padding="sm">
                        <div className="flex items-center justify-between gap-2">
                          <p className="font-semibold text-ink">{list.title}</p>
                          {isOwner && list.visibility !== "PUBLIC" ? <Badge variant="default">Privada</Badge> : null}
                        </div>
                        <p className="mt-1 text-sm text-muted">{list._count.items} series</p>
                      </Card>
                    </Link>
                  ))}
                </FixedGrid>
              ) : (
                <EmptyState title="Nenhuma lista publica" copy="Listas publicas aparecem aqui." />
              )
            ) : (
              <EmptyState icon={<EyeOffIcon className="h-6 w-6" />} title="Oculto" copy="Este usuario optou por nao exibir listas." />
            )}
          </section>

          <section className="space-y-3">
            <h2 className="section-title">Reviews</h2>
            {canSeeReviews ? (
              reviews.length ? (
                <div className="space-y-3">
                  {reviews.map((review) => (
                    <Card key={review.id}>
                      <div className="flex items-center justify-between gap-2">
                        <Link href={`/series/${review.series.slug}`} className="font-semibold text-ink">
                          {review.series.title}
                        </Link>
                        <Badge variant="warning">{review.rating}/5</Badge>
                      </div>
                      <p className="mt-2 text-sm text-muted">{review.body}</p>
                      {isOwner && review.visibility !== "PUBLIC" ? (
                        <Badge variant="default" className="mt-2">
                          Privada
                        </Badge>
                      ) : null}
                    </Card>
                  ))}
                </div>
              ) : (
                <EmptyState title="Nenhuma review publica" copy="Reviews publicas aparecem aqui." />
              )
            ) : (
              <EmptyState icon={<EyeOffIcon className="h-6 w-6" />} title="Oculto" copy="Este usuario optou por nao exibir reviews." />
            )}
          </section>

          {canSeeReviews && reviewStats ? <ReviewsStatsSection stats={reviewStats} mostReviewed={mostReviewedSeries} /> : null}

          {canSeeActivity ? (
            <ProfileTimeline activities={activity} />
          ) : (
            <section className="space-y-3">
              <h2 className="section-title">Atividade</h2>
              <EmptyState icon={<EyeOffIcon className="h-6 w-6" />} title="Oculto" copy="Este usuario optou por nao exibir atividade." />
            </section>
          )}
        </>
      )}
    </div>
  );
}
