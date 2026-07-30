import Link from "next/link";
import { Card } from "@/components/ui/card";
import { Tabs } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { UserSearchBar } from "@/components/feed/user-search-bar";
import { FeedTimeline } from "@/components/feed/feed-timeline";
import { FeedDiscoveryPanel } from "@/components/feed/feed-discovery-panel";
import { SocialCounters } from "@/components/social/social-counters";
import { getCurrentUser } from "@/lib/auth/server";
import { getGlobalFeed, getPersonalFeed, getFollowingFeed } from "@/lib/social/activity";
import { getFeaturedReview, getTrendingSeries } from "@/lib/social/feed-discovery";
import { prisma } from "@/lib/db/prisma";

type FeedSearchParams = { view?: string };

const FEED_EMPTY_COPY: Record<"personal" | "following" | "global", { title: string; copy: string }> = {
  personal: {
    title: "Ainda nao ha atividades por aqui",
    copy: "Siga mais pessoas ou explore novos perfis para comecar a preencher seu Feed."
  },
  following: {
    title: "Ainda nao ha atividades por aqui",
    copy: "Siga mais pessoas ou explore novos perfis para comecar a preencher seu Feed."
  },
  global: {
    title: "Ainda nao ha atividades por aqui",
    copy: "Atividades publicas recentes da comunidade aparecem aqui."
  }
};

/**
 * INSERIES-FEED-REDESIGN-01 — o Feed agora e o centro social do inSeries: cabecalho -> busca de
 * usuarios (substitui /explore por completo) -> filtros -> timeline (o elemento principal,
 * paginado de verdade — ver lib/social/activity.ts) -> conteudos complementares (Trending +
 * Review em destaque) por ultimo, nunca competindo com a timeline. "Usuarios ativos" e
 * "Discussoes recentes" foram removidos (ver lib/social/feed-discovery.ts para o porque).
 */
export default async function FeedPage({ searchParams }: { searchParams: Promise<FeedSearchParams> }) {
  const params = await searchParams;
  const user = await getCurrentUser();
  const view = params.view === "global" ? "global" : params.view === "following" ? "following" : "personal";

  const [counts, timelinePage, trending, featuredReview] = await Promise.all([
    user
      ? prisma.user.findUnique({ where: { id: user.id }, select: { _count: { select: { followers: true, following: true } } } })
      : Promise.resolve(null),
    view === "global"
      ? getGlobalFeed(user?.id ?? null)
      : user
        ? view === "following"
          ? getFollowingFeed(user.id)
          : getPersonalFeed(user.id)
        : Promise.resolve({ items: [], nextCursor: null }),
    getTrendingSeries(),
    getFeaturedReview()
  ]);

  const canSeeTimeline = view === "global" || Boolean(user);
  const emptyState = FEED_EMPTY_COPY[view];

  return (
    <div className="space-y-6">
      <div className="space-y-1.5">
        <p className="eyebrow">Rede social</p>
        <h1 className="section-title">Feed</h1>
        <p className="section-copy">Descubra o que sua comunidade esta assistindo, avaliando e compartilhando.</p>
        {user && counts ? <SocialCounters username={user.username} following={counts._count.following} followers={counts._count.followers} /> : null}
      </div>

      <UserSearchBar />

      <Tabs
        label="Visualizacao do feed"
        items={[
          { href: "/feed?view=personal", label: "Para voce" },
          { href: "/feed?view=following", label: "Seguindo" },
          { href: "/feed?view=global", label: "Global" }
        ]}
        active={`/feed?view=${view}`}
      />

      {canSeeTimeline ? (
        <FeedTimeline
          view={view}
          initialItems={timelinePage.items}
          initialCursor={timelinePage.nextCursor}
          emptyTitle={emptyState.title}
          emptyCopy={emptyState.copy}
          authenticated={Boolean(user)}
        />
      ) : (
        <Card className="space-y-3 text-center">
          <p className="text-lg font-semibold text-ink">Entre para ver seu feed</p>
          <p className="text-sm text-muted">Faca login para acompanhar a atividade de quem voce segue.</p>
          <Link href="/login" className="inline-flex justify-center">
            <Button>Entrar</Button>
          </Link>
        </Card>
      )}

      <FeedDiscoveryPanel trending={trending} featuredReview={featuredReview} />
    </div>
  );
}
