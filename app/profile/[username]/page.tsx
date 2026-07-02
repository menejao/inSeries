import Link from "next/link";
import { notFound } from "next/navigation";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { FollowButton } from "@/components/social/follow-button";
import { getCurrentUser } from "@/lib/auth/server";
import { prisma } from "@/lib/db/prisma";
import {
  getProfileByUsername,
  getPublicListsForUser,
  getPublicReviewsForUser,
  getWatchStateSeries,
  isFollowing
} from "@/lib/social/profile";
import { formatDate, getInitials } from "@/lib/utils";

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

  const [watchingSeries, completedSeries, lists, reviews] = await Promise.all([
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
            include: { series: { select: { id: true, slug: true, title: true } } },
            orderBy: { updatedAt: "desc" },
            take: 12
          })
        : getPublicReviewsForUser(profile.id)
      : Promise.resolve([])
  ]);

  return (
    <div className="space-y-6">
      <Card className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
          <Avatar label={getInitials(profile.name)} src={profile.avatarUrl} className="h-20 w-20 text-lg" />
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="section-title">{profile.name}</h1>
              <Badge>@{profile.username}</Badge>
              {profile.isProfilePrivate ? <Badge>Privado</Badge> : null}
            </div>
            {profile.bio ? <p className="section-copy max-w-xl">{profile.bio}</p> : null}
            <p className="text-xs text-slate-400">Entrou em {formatDate(profile.createdAt)}</p>
          </div>
        </div>
        <div>
          {isOwner ? (
            <Link href="/settings" className="text-sm font-semibold text-amber-200">
              Editar perfil
            </Link>
          ) : (
            <FollowButton username={profile.username} initialFollowing={viewerFollows} authenticated={Boolean(viewer)} />
          )}
        </div>
      </Card>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Card>
          <p className="text-sm text-slate-300">Seguidores</p>
          <p className="mt-2 text-3xl font-black text-ink">{profile._count.followers}</p>
        </Card>
        <Card>
          <p className="text-sm text-slate-300">Seguindo</p>
          <p className="mt-2 text-3xl font-black text-ink">{profile._count.following}</p>
        </Card>
        <Card>
          <p className="text-sm text-slate-300">Listas</p>
          <p className="mt-2 text-3xl font-black text-ink">{hidden ? "-" : lists.length}</p>
        </Card>
        <Card>
          <p className="text-sm text-slate-300">Reviews</p>
          <p className="mt-2 text-3xl font-black text-ink">{hidden ? "-" : reviews.length}</p>
        </Card>
      </div>

      {hidden ? (
        <EmptyState title="Perfil privado" copy="Este usuario mantem series, listas e reviews visiveis apenas para si mesmo." />
      ) : (
        <>
          <section className="space-y-3">
            <h2 className="text-xl font-semibold text-ink">Assistindo</h2>
            {canSeeWatching ? (
              watchingSeries.length ? (
                <div className="grid gap-3 md:grid-cols-2">
                  {watchingSeries.map((series) => (
                    <Card key={series.id}>
                      <Link href={`/series/${series.slug}`} className="font-semibold text-ink">
                        {series.title}
                      </Link>
                      <p className="mt-1 text-sm text-slate-300">{series.firstAirYear ?? "n/d"}</p>
                    </Card>
                  ))}
                </div>
              ) : (
                <EmptyState title="Nada assistindo" copy="Quando este usuario comecar uma serie, ela aparece aqui." />
              )
            ) : (
              <EmptyState title="Oculto" copy="Este usuario optou por nao exibir series assistindo." />
            )}
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-semibold text-ink">Concluidas</h2>
            {canSeeCompleted ? (
              completedSeries.length ? (
                <div className="grid gap-3 md:grid-cols-2">
                  {completedSeries.map((series) => (
                    <Card key={series.id}>
                      <Link href={`/series/${series.slug}`} className="font-semibold text-ink">
                        {series.title}
                      </Link>
                      <p className="mt-1 text-sm text-slate-300">{series.firstAirYear ?? "n/d"}</p>
                    </Card>
                  ))}
                </div>
              ) : (
                <EmptyState title="Nada concluido" copy="Series concluidas aparecem aqui quando publicas." />
              )
            ) : (
              <EmptyState title="Oculto" copy="Este usuario optou por nao exibir series concluidas." />
            )}
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-semibold text-ink">Listas</h2>
            {canSeeLists ? (
              lists.length ? (
                <div className="grid gap-3 md:grid-cols-2">
                  {lists.map((list) => (
                    <Card key={list.id}>
                      <div className="flex items-center justify-between gap-2">
                        <Link href={`/lists/${list.id}`} className="font-semibold text-ink">
                          {list.title}
                        </Link>
                        {isOwner && list.visibility !== "PUBLIC" ? <Badge>Privada</Badge> : null}
                      </div>
                      <p className="mt-1 text-sm text-slate-300">{list._count.items} series</p>
                    </Card>
                  ))}
                </div>
              ) : (
                <EmptyState title="Nenhuma lista publica" copy="Listas publicas aparecem aqui." />
              )
            ) : (
              <EmptyState title="Oculto" copy="Este usuario optou por nao exibir listas." />
            )}
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-semibold text-ink">Reviews</h2>
            {canSeeReviews ? (
              reviews.length ? (
                <div className="space-y-3">
                  {reviews.map((review) => (
                    <Card key={review.id}>
                      <div className="flex items-center justify-between gap-2">
                        <Link href={`/series/${review.series.slug}`} className="font-semibold text-ink">
                          {review.series.title}
                        </Link>
                        <Badge>{review.rating}/5</Badge>
                      </div>
                      <p className="mt-2 text-sm text-slate-300">{review.body}</p>
                      {isOwner && review.visibility !== "PUBLIC" ? <Badge className="mt-2">Privada</Badge> : null}
                    </Card>
                  ))}
                </div>
              ) : (
                <EmptyState title="Nenhuma review publica" copy="Reviews publicas aparecem aqui." />
              )
            ) : (
              <EmptyState title="Oculto" copy="Este usuario optou por nao exibir reviews." />
            )}
          </section>
        </>
      )}
    </div>
  );
}
