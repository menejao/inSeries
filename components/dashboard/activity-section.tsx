import Link from "next/link";
import { ActivityCard } from "@/components/feed/activity-card";
import type { ActivityFeedItem } from "@/lib/social/activity";

/**
 * Fase 7 (INSERIES-DASHBOARD-PREMIUM-01) — "Atividade recente": reuses `ActivityCard`
 * unchanged and `getRecentActivityForUser` (lib/social/activity.ts), which already scopes
 * to `where: { userId }` only — the user's own actions, never anyone they follow. That's
 * exactly the ticket's "Voce terminou/comecou/avaliou" framing; no new query or component.
 */
export function ActivitySection({ activity }: { activity: ActivityFeedItem[] }) {
  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <h2 className="section-title">Atividade recente</h2>
        <Link href="/feed" className="link-accent text-sm">
          Ver feed
        </Link>
      </div>
      {activity.length ? (
        <div className="space-y-3">
          {activity.map((item) => (
            <ActivityCard key={item.id} activity={item} />
          ))}
        </div>
      ) : (
        <p className="rounded-2xl border border-dashed border-border p-6 text-center text-sm text-muted">
          Suas acoes recentes (episodios assistidos, reviews, listas) aparecem aqui.
        </p>
      )}
    </section>
  );
}
