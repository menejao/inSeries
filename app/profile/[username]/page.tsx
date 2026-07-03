import Link from "next/link";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { FollowButton } from "@/components/social/follow-button";
import { ActivityCard } from "@/components/feed/activity-card";
import { buttonVariants } from "@/components/ui/button";
import { EyeOffIcon } from "@/components/ui/icons";
import { getCurrentUser } from "@/lib/auth/server";
import { prisma } from "@/lib/db/prisma";
import {
  getProfileByUsername,
  getPublicListsForUser,
  getPublicReviewsForUser,
  getWatchStateSeries,
  isFollowing
} from "@/lib/social/profile";
import { getProfileActivity } from "@/lib/social/activity";
import { formatDate, getInitials } from "@/lib/utils";

function ProfileSection<T>({
  title,
  visible,
  items,
  emptyTitle,
  emptyCopy,
  hiddenCopy,
  renderItem,
  layout = "grid"
}: {
  title: string;
  visible: boolean;
  items: T[];
  emptyTitle: string;
  emptyCopy: string;
  hiddenCopy: string;
  renderItem: (item: T) => ReactNode;
  layout?: "grid" | "stack";
}) {
  return (
    <section className="space-y-3">
      <h2 className="text-xl font-semibold text-ink">{title}</h2>
      {visible ? (
        items.length ? (
          <div className={layout === "grid" ? "grid gap-3 sm:grid-cols-2" : "space-y-3"}>{items.map(renderItem)}</div>
        ) : (
          <EmptyState title={emptyTitle} copy={emptyCopy} />
        )
      ) : (
        <EmptyState icon={<EyeOffIcon className="h-6 w-6" />} title="Oculto" copy={hiddenCopy} />
      )}
    </section>
  );
}

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

  const [watchingSeries, completedSeries, lists, reviews, activity] = await Promise.all([
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
      : Promise.resolve([]),
    canSeeActivity ? getProfileActivity(profile.id, viewer?.id ?? null, 10) : Promise.resolve([])
  ]);

  return (
    <div className="space-y-6">
      <Card className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
          <Avatar label={getInitials(profile.name)} name={profile.name} src={profile.avatarUrl} size="xl" />
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="section-title">{profile.name}</h1>
              <Badge variant="secondary">@{profile.username}</Badge>
              {profile.isProfilePrivate ? <Badge variant="default">Privado</Badge> : null}
            </div>
            {profile.bio ? <p className="section-copy max-w-xl">{profile.bio}</p> : null}
            <p className="text-xs text-subtle">Entrou em {formatDate(profile.createdAt)}</p>
          </div>
        </div>
        <div>
          {isOwner ? (
            <Link href="/settings" className={buttonVariants({ variant: "secondary" })}>
              Editar perfil
            </Link>
          ) : (
            <FollowButton username={profile.username} initialFollowing={viewerFollows} authenticated={Boolean(viewer)} />
          )}
        </div>
      </Card>

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
          <ProfileSection
            title="Assistindo"
            visible={canSeeWatching}
            items={watchingSeries}
            emptyTitle="Nada assistindo"
            emptyCopy="Quando este usuario comecar uma serie, ela aparece aqui."
            hiddenCopy="Este usuario optou por nao exibir series assistindo."
            renderItem={(series) => (
              <Link key={series.id} href={`/series/${series.slug}`}>
                <Card interactive padding="sm">
                  <p className="font-semibold text-ink">{series.title}</p>
                  <p className="mt-1 text-sm text-muted">{series.firstAirYear ?? "n/d"}</p>
                </Card>
              </Link>
            )}
          />

          <ProfileSection
            title="Concluidas"
            visible={canSeeCompleted}
            items={completedSeries}
            emptyTitle="Nada concluido"
            emptyCopy="Series concluidas aparecem aqui quando publicas."
            hiddenCopy="Este usuario optou por nao exibir series concluidas."
            renderItem={(series) => (
              <Link key={series.id} href={`/series/${series.slug}`}>
                <Card interactive padding="sm">
                  <p className="font-semibold text-ink">{series.title}</p>
                  <p className="mt-1 text-sm text-muted">{series.firstAirYear ?? "n/d"}</p>
                </Card>
              </Link>
            )}
          />

          <ProfileSection
            title="Listas"
            visible={canSeeLists}
            items={lists}
            emptyTitle="Nenhuma lista publica"
            emptyCopy="Listas publicas aparecem aqui."
            hiddenCopy="Este usuario optou por nao exibir listas."
            renderItem={(list) => (
              <Link key={list.id} href={`/lists/${list.id}`}>
                <Card interactive padding="sm">
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-semibold text-ink">{list.title}</p>
                    {isOwner && list.visibility !== "PUBLIC" ? <Badge variant="default">Privada</Badge> : null}
                  </div>
                  <p className="mt-1 text-sm text-muted">{list._count.items} series</p>
                </Card>
              </Link>
            )}
          />

          <ProfileSection
            title="Reviews"
            visible={canSeeReviews}
            items={reviews}
            layout="stack"
            emptyTitle="Nenhuma review publica"
            emptyCopy="Reviews publicas aparecem aqui."
            hiddenCopy="Este usuario optou por nao exibir reviews."
            renderItem={(review) => (
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
            )}
          />

          <ProfileSection
            title="Atividade"
            visible={canSeeActivity}
            items={activity}
            layout="stack"
            emptyTitle="Nenhuma atividade publica"
            emptyCopy="Acoes publicas deste usuario aparecem aqui."
            hiddenCopy="Este usuario optou por nao exibir atividade."
            renderItem={(item) => <ActivityCard key={item.id} activity={item} />}
          />
        </>
      )}
    </div>
  );
}
