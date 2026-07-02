import Link from "next/link";
import { ActivityCard } from "@/components/feed/activity-card";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { getCurrentUser } from "@/lib/auth/server";
import { getGlobalFeed, getPersonalFeed } from "@/lib/social/activity";
import { cn } from "@/lib/utils";

type FeedSearchParams = { view?: string };

const viewTabs = [
  { key: "personal", label: "Para voce" },
  { key: "global", label: "Global" }
] as const;

async function PersonalFeedList({ userId }: { userId: string }) {
  const activities = await getPersonalFeed(userId);

  return activities.length ? (
    <div className="space-y-3">
      {activities.map((activity) => (
        <ActivityCard key={activity.id} activity={activity} />
      ))}
    </div>
  ) : (
    <EmptyState title="Seu feed esta vazio" copy="Siga outros usuarios ou registre atividades para ver novidades aqui." />
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
    <EmptyState title="Nada por aqui ainda" copy="Atividades publicas recentes da comunidade aparecem aqui." />
  );
}

export default async function FeedPage({ searchParams }: { searchParams: Promise<FeedSearchParams> }) {
  const params = await searchParams;
  const user = await getCurrentUser();
  const view = params.view === "global" ? "global" : "personal";

  return (
    <div className="space-y-6">
      <div>
        <h1 className="section-title">Feed</h1>
        <p className="section-copy">Descubra o que as pessoas que voce segue estao assistindo, avaliando e listando.</p>
      </div>

      <div className="flex gap-2 overflow-x-auto pb-1">
        {viewTabs.map((tab) => (
          <Link
            key={tab.key}
            href={`/feed?view=${tab.key}`}
            className={cn(
              "rounded-full px-4 py-2 text-sm transition",
              view === tab.key ? "bg-ember text-night" : "bg-slate-900/60 text-slate-300"
            )}
          >
            {tab.label}
          </Link>
        ))}
      </div>

      {view === "personal" ? (
        user ? (
          <PersonalFeedList userId={user.id} />
        ) : (
          <Card className="space-y-3 text-center">
            <p className="text-lg font-semibold text-ink">Entre para ver seu feed</p>
            <p className="text-sm text-slate-300">Faca login para acompanhar a atividade de quem voce segue.</p>
            <Link
              href="/login"
              className="inline-flex min-h-11 items-center justify-center rounded-full bg-ember px-4 text-sm font-semibold text-night transition hover:bg-orange-400"
            >
              Entrar
            </Link>
          </Card>
        )
      ) : (
        <GlobalFeedList viewerId={user?.id ?? null} />
      )}
    </div>
  );
}
