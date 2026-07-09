import Link from "next/link";
import { Card } from "@/components/ui/card";
import { FixedGrid } from "@/components/ui/fixed-grid";
import { PosterImage } from "@/components/media/poster-image";
import { CalendarIcon, CheckCircleIcon, FlameIcon, SparklesIcon, StarIcon, TvIcon } from "@/components/ui/icons";
import { formatRelativeDate } from "@/lib/utils";
import type { ProfileHighlight } from "@/lib/profile-page/highlights";

const HIGHLIGHT_ICONS: Record<ProfileHighlight["key"], typeof StarIcon> = {
  bestRated: StarIcon,
  biggestMarathon: TvIcon,
  topDiscovery: FlameIcon,
  topQuality: SparklesIcon,
  mostProgress: CheckCircleIcon
};

/**
 * Fase 6 (INSERIES-PROFILE-PREMIUM-01) — cada destaque e um card com poster + rotulo +
 * valor, todos derivados em `lib/profile-page/highlights.ts` (puro, zero query nova). Toda
 * a secao (inclusive "Ultima atividade", que reaproveita `streaks.lastWatchedAt` de
 * `getUserStats`) some por completo se nao houver nenhum destaque real.
 */
export function ProfileHighlights({ highlights, lastActivityAt }: { highlights: ProfileHighlight[]; lastActivityAt: Date | null }) {
  if (!highlights.length && !lastActivityAt) return null;

  return (
    <section className="space-y-4">
      <h2 className="section-title">Destaques</h2>
      <FixedGrid mobile={2} tablet={3} desktop={3}>
        {highlights.map((highlight) => {
          const Icon = HIGHLIGHT_ICONS[highlight.key];
          return (
            <Link key={highlight.key} href={`/series/${highlight.series.slug}`}>
              <Card interactive padding="sm" className="flex gap-3">
                <div className="relative aspect-[2/3] w-16 shrink-0 overflow-hidden rounded-xl">
                  <PosterImage src={highlight.series.posterUrl} alt={highlight.series.title} sizes="64px" />
                </div>
                <div className="min-w-0 space-y-1">
                  <span className="flex items-center gap-1.5 text-xs text-subtle">
                    <Icon className="h-3.5 w-3.5" /> {highlight.label}
                  </span>
                  <p className="line-clamp-1 font-semibold text-ink">{highlight.series.title}</p>
                  <p className="text-sm font-medium text-primary-text">{highlight.value}</p>
                </div>
              </Card>
            </Link>
          );
        })}
        {lastActivityAt ? (
          <Card padding="sm" className="flex gap-3">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary/12 text-primary-text">
              <CalendarIcon className="h-5 w-5" />
            </span>
            <div className="min-w-0 space-y-1">
              <span className="text-xs text-subtle">Ultima atividade</span>
              <p className="font-semibold text-ink">{formatRelativeDate(lastActivityAt)}</p>
            </div>
          </Card>
        ) : null}
      </FixedGrid>
    </section>
  );
}
