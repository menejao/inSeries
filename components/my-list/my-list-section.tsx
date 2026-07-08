import Link from "next/link";
import { PosterImage } from "@/components/media/poster-image";
import { FixedGrid } from "@/components/ui/fixed-grid";
import { Badge } from "@/components/ui/badge";
import type { MyListGroupKey, MyListSummary } from "@/lib/my-list";

/** Only the 3 groups with a dedicated existing page get a real "Ver tudo" link — Paused/Favorites reuse the general "/me" overview (no new route invented for this sprint). */
const GROUP_HREF: Record<MyListGroupKey, string> = {
  WATCHING: "/me/watching",
  WANT_TO_WATCH: "/me/watchlist",
  COMPLETED: "/me/completed",
  PAUSED: "/me",
  FAVORITES: "/me"
};

/**
 * Fase 5 (INSERIES-DASHBOARD-PREMIUM-01) — "Minha Lista": one compact preview grid per
 * status group (Assistindo/Quero assistir/Concluidas/Pausadas/Favoritas), each with its own
 * total count and a small fixed-grid preview. Mobile/tablet/desktop column counts (2/3/6)
 * all divide the 6-item preview limit evenly, so a full preview never ends mid-row.
 */
export function MyListSection({ summary }: { summary: MyListSummary }) {
  return (
    <section className="space-y-4">
      <div>
        <h2 className="section-title">Minha Lista</h2>
        <p className="section-copy">Onde suas series estao agora, agrupadas por status.</p>
      </div>

      <div className="space-y-6">
        {summary.groups.map((group) => (
          <div key={group.key} className="space-y-3">
            <div className="flex items-center justify-between gap-4">
              <h3 className="flex items-center gap-2 text-base font-semibold text-ink">
                {group.label}
                <Badge variant="secondary">{group.count}</Badge>
              </h3>
              <Link href={GROUP_HREF[group.key]} className="link-accent text-sm">
                Ver tudo
              </Link>
            </div>
            {group.preview.length ? (
              <FixedGrid mobile={2} tablet={3} desktop={6}>
                {group.preview.map((series) => (
                  <Link
                    key={series.id}
                    href={`/series/${series.slug}`}
                    aria-label={`Abrir ${series.title}`}
                    className="group relative block aspect-[2/3] overflow-hidden rounded-2xl border border-border transition duration-200 ease-out hover:-translate-y-1 hover:border-border-strong hover:shadow-raised"
                  >
                    <PosterImage
                      src={series.posterUrl}
                      alt={series.title}
                      sizes="(min-width: 1024px) 160px, (min-width: 640px) 25vw, 33vw"
                      imageClassName="transition duration-300 ease-out group-hover:scale-105"
                    />
                  </Link>
                ))}
              </FixedGrid>
            ) : (
              <p className="rounded-2xl border border-dashed border-border p-4 text-center text-sm text-muted">
                Nenhuma serie {group.label.toLowerCase()} ainda.
              </p>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}
