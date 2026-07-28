import Link from "next/link";
import { Card } from "@/components/ui/card";
import { Tabs } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { FeedActivityList } from "@/components/feed/feed-activity-list";
import { FeedDiscoveryPanel } from "@/components/feed/feed-discovery-panel";
import { SocialCounters } from "@/components/social/social-counters";
import { getCurrentUser } from "@/lib/auth/server";
import { getGlobalFeed, getPersonalFeed, getFollowingFeed } from "@/lib/social/activity";
import { getActiveUsers, getFeaturedReviews, getRecentDiscussions, getTrendingSeries } from "@/lib/social/feed-discovery";
import { prisma } from "@/lib/db/prisma";

type FeedSearchParams = { view?: string };

// Fase 2/6 (INSERIES-SOCIAL-FEED-01) — um unico batch por view alimenta a lista principal
// (filtro/ordenacao client-side) E os 4 blocos de descoberta (agregacao em memoria) — nunca
// duas consultas para a mesma tela.
const FEED_BATCH_SIZE = 150;

async function PersonalFeed({ userId }: { userId: string }) {
  const activities = await getPersonalFeed(userId, FEED_BATCH_SIZE);

  return (
    <div className="space-y-8">
      <FeedDiscoveryPanel
        trending={getTrendingSeries(activities)}
        featuredReviews={getFeaturedReviews(activities)}
        discussions={getRecentDiscussions(activities)}
        activeUsers={getActiveUsers(activities)}
      />
      <FeedActivityList
        activities={activities}
        emptyTitle="Seu feed esta vazio"
        emptyCopy="Siga outros usuarios ou registre atividades para ver novidades aqui."
        authenticated
      />
    </div>
  );
}

/** Fase 21 — "Seguindo": exclusivamente atividades de quem o usuario segue, nunca as proprias. */
async function FollowingFeed({ userId }: { userId: string }) {
  const activities = await getFollowingFeed(userId, FEED_BATCH_SIZE);

  return (
    <FeedActivityList
      activities={activities}
      emptyTitle="Seu feed de pessoas seguidas esta vazio"
      emptyCopy="Siga outros usuarios para acompanhar avaliacoes, series concluidas, favoritos e listas."
      authenticated
    />
  );
}

async function GlobalFeed({ viewerId }: { viewerId: string | null }) {
  const activities = await getGlobalFeed(viewerId, FEED_BATCH_SIZE);

  return (
    <div className="space-y-8">
      <FeedDiscoveryPanel
        trending={getTrendingSeries(activities)}
        featuredReviews={getFeaturedReviews(activities)}
        discussions={getRecentDiscussions(activities)}
        activeUsers={getActiveUsers(activities)}
      />
      <FeedActivityList
        activities={activities}
        emptyTitle="Nada por aqui ainda"
        emptyCopy="Atividades publicas recentes da comunidade aparecem aqui."
        authenticated={Boolean(viewerId)}
      />
    </div>
  );
}

/**
 * INSERIES-SOCIAL-FEED-01 — o Feed Social como centro de descoberta e interacao entre
 * usuarios: a mesma lista de atividades (getGlobalFeed/getPersonalFeed, ja privacy-aware)
 * agora alimenta cards premium, filtro/ordenacao e 4 blocos de descoberta, tudo derivado do
 * mesmo batch buscado uma unica vez por view. Ver README para o audit completo da Fase 1 e
 * as decisoes de cada bloco de descoberta.
 */
export default async function FeedPage({ searchParams }: { searchParams: Promise<FeedSearchParams> }) {
  const params = await searchParams;
  const user = await getCurrentUser();
  const view = params.view === "global" ? "global" : params.view === "following" ? "following" : "personal";

  const counts = user
    ? await prisma.user.findUnique({
        where: { id: user.id },
        select: { _count: { select: { followers: true, following: true } } }
      })
    : null;

  return (
    <div className="space-y-6">
      <div className="space-y-1.5">
        <p className="eyebrow">Rede social</p>
        <h1 className="section-title">Feed</h1>
        <p className="section-copy">Descubra o que as pessoas que voce segue estao assistindo, avaliando e listando.</p>
        {/* Fase 9 — resumo social do Feed: os dois contadores, compactos e clicaveis, nunca cards grandes de estatistica. */}
        {user && counts ? <SocialCounters username={user.username} following={counts._count.following} followers={counts._count.followers} /> : null}
      </div>

      <Tabs
        label="Visualizacao do feed"
        items={[
          { href: "/feed?view=personal", label: "Para voce" },
          { href: "/feed?view=following", label: "Seguindo" },
          { href: "/feed?view=global", label: "Global" }
        ]}
        active={`/feed?view=${view}`}
      />

      {view === "global" ? (
        <GlobalFeed viewerId={user?.id ?? null} />
      ) : user ? (
        view === "following" ? (
          <FollowingFeed userId={user.id} />
        ) : (
          <PersonalFeed userId={user.id} />
        )
      ) : (
        <Card className="space-y-3 text-center">
          <p className="text-lg font-semibold text-ink">Entre para ver seu feed</p>
          <p className="text-sm text-muted">Faca login para acompanhar a atividade de quem voce segue.</p>
          <Link href="/login" className="inline-flex justify-center">
            <Button>Entrar</Button>
          </Link>
        </Card>
      )}
    </div>
  );
}
