import Link from "next/link";
import { notFound } from "next/navigation";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { FollowButton } from "@/components/social/follow-button";
import { ProfileActionsMenu } from "@/components/social/profile-actions-menu";
import { FollowRequestsPanel } from "@/components/social/follow-requests-panel";
import { buttonVariants } from "@/components/ui/button";
import { EyeOffIcon, LockIcon } from "@/components/ui/icons";
import { ProfileHeader } from "@/components/profile/profile-header";
import { ProfilePersonaCard } from "@/components/profile/profile-persona-card";
import { ProfileHighlights } from "@/components/profile/profile-highlights";
import { ProfileSeriesLibrary } from "@/components/profile/profile-series-library";
import { ProfileReviewsPreview } from "@/components/profile/profile-reviews-preview";
import { ProfileListsPreview } from "@/components/profile/profile-lists-preview";
import { getCurrentUser } from "@/lib/auth/server";
import { getProfileByUsername, getPublicListsForUser, getPublicReviewsForUser, getWatchStateSeries } from "@/lib/social/profile";
import { getUserStats } from "@/lib/analytics";
import { getViewerPersonaForUser } from "@/lib/stats/persona-for-user";
import { getMyListFullForUser } from "@/lib/my-list";
import { computeProfileHighlights } from "@/lib/profile-page/highlights";
import { getFollowState, getPendingFollowRequests } from "@/lib/social/follow";
import { isMuted } from "@/lib/social/mute";
import { isBlocked } from "@/lib/social/block";
import { prisma } from "@/lib/db/prisma";

/**
 * INSERIES-PROFILE-REDESIGN-01 — o Perfil como vitrine da identidade do usuario, nao um
 * dashboard: cabecalho compacto (poucas estatisticas de destaque), perfil de espectador,
 * destaques visuais, previa de series (o modal existente, intocado), previa de reviews e
 * listas publicas. Removidos por completo: bloco de 10 estatisticas, "Continuar assistindo",
 * favoritas, feed/timeline de atividade e estatisticas de reviews — cada um ja vive (ou nunca
 * fez sentido fora) de uma pagina dedicada (Estatisticas, Dashboard, Feed). Secoes vazias
 * (bio/reviews/listas) somem por completo, nunca um "Nenhuma X" generico.
 */
export default async function ProfilePage({ params }: { params: Promise<{ username: string }> }) {
  const { username } = await params;
  const profile = await getProfileByUsername(username);

  if (!profile) {
    notFound();
  }

  const viewer = await getCurrentUser();
  const isOwner = viewer?.id === profile.id;
  const followState = viewer ? await getFollowState(viewer.id, profile.id) : "none";
  const [profileFollowsViewer, viewerMutedProfile, viewerBlockedProfile, pendingRequests] = await Promise.all([
    viewer && !isOwner ? prisma.follow.findUnique({ where: { followerId_followingId: { followerId: profile.id, followingId: viewer.id } } }) : null,
    viewer && !isOwner ? isMuted(viewer.id, profile.id) : false,
    viewer && !isOwner ? isBlocked(viewer.id, profile.id) : false,
    isOwner && profile.isProfilePrivate ? getPendingFollowRequests(profile.id) : Promise.resolve([])
  ]);

  // Perfil privado: conteudo so libera quando o follow foi ACEITO ("Solicitado" ainda oculta tudo).
  const hidden = profile.isProfilePrivate && !isOwner && followState !== "following";

  const canSeeWatching = isOwner || (!profile.isProfilePrivate && profile.showWatchingSeries);
  const canSeeCompleted = isOwner || (!profile.isProfilePrivate && profile.showWatchedSeries);
  const canSeeLists = isOwner || (!profile.isProfilePrivate && profile.showLists);
  const canSeeReviews = isOwner || (!profile.isProfilePrivate && profile.showReviews);
  // Nao existe uma flag de privacidade dedicada para estatisticas/destaques/perfil de
  // espectador (agregados, nao cobertos por nenhuma regra existente) — tratados como extensao
  // dos dois toggles que ja controlam as listas de series equivalentes.
  const canSeeStats = isOwner || (!profile.isProfilePrivate && (profile.showWatchingSeries || profile.showWatchedSeries));

  const [watchingSeries, completedSeries, lists, reviews, stats, fullList, persona] = await Promise.all([
    canSeeWatching ? getWatchStateSeries(profile.id, "WATCHING", 12) : Promise.resolve([]),
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
            take: 20
          })
        : getPublicReviewsForUser(profile.id)
      : Promise.resolve([]),
    canSeeStats ? getUserStats(profile.id) : Promise.resolve(null),
    canSeeStats ? getMyListFullForUser(profile.id) : Promise.resolve(null),
    canSeeStats ? getViewerPersonaForUser(profile.id) : Promise.resolve(null)
  ]);

  const highlightItems = fullList
    ? isOwner
      ? fullList.items
      : fullList.items.filter((item) => (item.state === "WATCHING" && canSeeWatching) || (item.state === "COMPLETED" && canSeeCompleted))
    : [];
  const highlights = computeProfileHighlights(highlightItems);

  // Series/Assistindo unificadas numa unica biblioteca (mesmo card, badge de status) — cada
  // metade so entra se a flag de privacidade correspondente autorizar.
  const libraryItems = [
    ...(canSeeWatching ? watchingSeries.map((series) => ({ ...series, state: "WATCHING" as const })) : []),
    ...(canSeeCompleted ? completedSeries.map((series) => ({ ...series, state: "COMPLETED" as const })) : [])
  ].sort((a, b) => {
    if (a.state !== b.state) return a.state === "WATCHING" ? -1 : 1;
    const aTime = a.lastActivityAt ? new Date(a.lastActivityAt).getTime() : 0;
    const bTime = b.lastActivityAt ? new Date(b.lastActivityAt).getTime() : 0;
    return bTime - aTime;
  });

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
            <div className="flex items-center gap-2">
              <FollowButton username={profile.username} initialState={followState} authenticated={Boolean(viewer)} />
              {viewer ? (
                <ProfileActionsMenu
                  username={profile.username}
                  isMuted={viewerMutedProfile}
                  isBlocked={viewerBlockedProfile}
                  followsViewer={Boolean(profileFollowsViewer)}
                />
              ) : null}
            </div>
          )
        }
      />

      {isOwner && pendingRequests.length ? (
        <FollowRequestsPanel requests={pendingRequests.map((request) => ({ id: request.id, requester: request.requester }))} />
      ) : null}

      <div className="grid grid-cols-2 gap-4">
        <Link href={`/profile/${profile.username}/followers`}>
          <Card interactive>
            <p className="text-sm text-muted">Seguidores</p>
            <p className="mt-2 text-3xl font-black text-ink">{profile._count.followers}</p>
          </Card>
        </Link>
        <Link href={`/profile/${profile.username}/following`}>
          <Card interactive>
            <p className="text-sm text-muted">Seguindo</p>
            <p className="mt-2 text-3xl font-black text-ink">{profile._count.following}</p>
          </Card>
        </Link>
      </div>

      {hidden ? (
        <EmptyState
          icon={followState === "requested" ? <LockIcon className="h-6 w-6" /> : <EyeOffIcon className="h-6 w-6" />}
          title="Este perfil e privado"
          copy={
            followState === "requested"
              ? "Sua solicitacao para seguir foi enviada. Assim que for aceita, voce podera ver o perfil desta pessoa."
              : "Siga este usuario para visualizar seu perfil."
          }
        />
      ) : (
        <>
          {persona ? <ProfilePersonaCard persona={persona} /> : null}

          <ProfileHighlights highlights={highlights} lastActivityAt={canSeeStats ? (stats?.streaks.lastWatchedAt ?? null) : null} />

          <ProfileSeriesLibrary items={libraryItems} />

          {canSeeLists ? (
            <ProfileListsPreview lists={lists.map((list) => ({ id: list.id, title: list.title, itemCount: list._count.items }))} />
          ) : null}

          {canSeeReviews ? <ProfileReviewsPreview reviews={reviews} /> : null}
        </>
      )}
    </div>
  );
}
