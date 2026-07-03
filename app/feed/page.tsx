import Link from "next/link";
import { ActivityCard } from "@/components/feed/activity-card";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Tabs } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { FilmIcon } from "@/components/ui/icons";
import { getCurrentUser } from "@/lib/auth/server";
import { getGlobalFeed, getPersonalFeed } from "@/lib/social/activity";

type FeedSearchParams = { view?: string };

async function PersonalFeedList({ userId }: { userId: string }) {
  const activities = await getPersonalFeed(userId);

  return activities.length ? (
    <div className="space-y-3">
      {activities.map((activity) => (
        <ActivityCard key={activity.id} activity={activity} />
      ))}
    </div>
  ) : (
    <EmptyState
      icon={<FilmIcon className="h-6 w-6" />}
      title="Seu feed esta vazio"
      copy="Siga outros usuarios ou registre atividades para ver novidades aqui."
    />
  );
}

async function GlobalFeedList({ viewerId }: { viewerId: string | null }) {
  const activities = await getGlobalFeed(viewerId);

  return activities.length ? (
    <div className="space-y-3">
      {activities.map((activity) => (
        <ActivityCard key={activity.id} activity={activity} />
      ))}
    </div>
  ) : (
    <EmptyState icon={<FilmIcon className="h-6 w-6" />} title="Nada por aqui ainda" copy="Atividades publicas recentes da comunidade aparecem aqui." />
  );
}

export default async function FeedPage({ searchParams }: { searchParams: Promise<FeedSearchParams> }) {
  const params = await searchParams;
  const user = await getCurrentUser();
  const view = params.view === "global" ? "global" : "personal";

  return (
    <div className="space-y-6">
      <div>
        <p className="eyebrow">Comunidade</p>
        <h1 className="section-title">Feed</h1>
        <p className="section-copy">Descubra o que as pessoas que voce segue estao assistindo, avaliando e listando.</p>
      </div>

      <Tabs
        label="Visualizacao do feed"
        items={[
          { href: "/feed?view=personal", label: "Para voce" },
          { href: "/feed?view=global", label: "Global" }
        ]}
        active={`/feed?view=${view}`}
      />

      {view === "personal" ? (
        user ? (
          <PersonalFeedList userId={user.id} />
        ) : (
          <Card className="space-y-3 text-center">
            <p className="text-lg font-semibold text-ink">Entre para ver seu feed</p>
            <p className="text-sm text-muted">Faca login para acompanhar a atividade de quem voce segue.</p>
            <Link href="/login" className="inline-flex justify-center">
              <Button>Entrar</Button>
            </Link>
          </Card>
        )
      ) : (
        <GlobalFeedList viewerId={user?.id ?? null} />
      )}
    </div>
  );
}
