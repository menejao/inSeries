import Link from "next/link";
import { FixedGrid } from "@/components/ui/fixed-grid";
import { SeriesPosterCard, type PosterCardVariant } from "@/components/media/series-poster-card";
import type { Series } from "@/lib/types";

/**
 * Fase 8 (INSERIES-DASHBOARD-PREMIUM-01) — the shared shell for every "row of series
 * posters" section on the Dashboard (Bombando Agora, Lancamentos): same header pattern,
 * same `FixedGrid`, same `SeriesPosterCard` — never a bespoke grid/card per section.
 */
export function DashboardPosterRow({
  title,
  href,
  items,
  variant,
  emptyText
}: {
  title: string;
  href: string;
  items: Series[];
  variant?: PosterCardVariant;
  emptyText: string;
}) {
  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <h2 className="section-title">{title}</h2>
        <Link href={href} className="link-accent text-sm">
          Ver tudo
        </Link>
      </div>
      {items.length ? (
        <FixedGrid mobile={2} tablet={4} desktop={4}>
          {items.map((series, index) => (
            <SeriesPosterCard key={series.id} series={series} variant={variant} priority={index < 2} />
          ))}
        </FixedGrid>
      ) : (
        <p className="rounded-2xl border border-dashed border-border p-6 text-center text-sm text-muted">{emptyText}</p>
      )}
    </section>
  );
}
