import Link from "next/link";
import { WatchNextCard } from "@/components/watch-next/watch-next-card";
import type { WatchNextResult } from "@/lib/watch-next";

/**
 * Fase 8/10 (INSERIES-DASHBOARD-PREMIUM-01) — same single-column stack the dedicated
 * `/watch-next` page already uses for `WatchNextCard` (a full-width horizontal list card,
 * never a poster grid) — one item per row at every breakpoint, which trivially satisfies
 * the global fixed-items-per-row rule (N=1, uniform across mobile/tablet/desktop).
 */
export function WatchNextSection({ watchNext }: { watchNext: WatchNextResult }) {
  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <h2 className="section-title">Watch Next</h2>
        <Link href="/watch-next" className="link-accent text-sm">
          Ver tudo
        </Link>
      </div>
      {watchNext.items.length ? (
        <div className="space-y-3">
          {watchNext.items.map((item) => (
            <WatchNextCard key={item.episode.id} item={item} />
          ))}
        </div>
      ) : (
        <p className="rounded-2xl border border-dashed border-border p-6 text-center text-sm text-muted">
          {watchNext.hasTrackedSeries ? "Voce esta em dia com suas series." : "Voce ainda nao segue nenhuma serie."}
        </p>
      )}
    </section>
  );
}
