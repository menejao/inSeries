import { FixedGrid } from "@/components/ui/fixed-grid";
import { BookIcon, ChartIcon, ClockIcon, StarIcon, TrophyIcon } from "@/components/ui/icons";
import type { UserReviewStats, MostReviewedSeries } from "@/lib/social/review-stats";

/**
 * Fase 7/8 (INSERIES-REVIEWS-COMMENTS-PREMIUM-01) — mesmo padrao visual de tile ja usado em
 * ProfileStatsSection/DashboardStatsSection. "Nota media" cobre tanto "media das notas"
 * quanto "nota media do usuario" (o mesmo numero, no contexto de UM usuario — nao ha uma
 * segunda media distinta a mostrar aqui; ver README). "Serie mais avaliada" e um agregado
 * GLOBAL (todas as reviews publicas do app), nao deste usuario — o unique constraint
 * `[userId, seriesId]` de Review torna uma versao "por usuario" sempre 0 ou 1.
 */
export function ReviewsStatsSection({ stats, mostReviewed }: { stats: UserReviewStats; mostReviewed?: MostReviewedSeries | null }) {
  const tiles = [
    { icon: BookIcon, label: "Reviews", value: stats.count },
    { icon: StarIcon, label: "Nota media", value: stats.count ? `${stats.averageRating.toFixed(1)}/5` : "—" },
    { icon: ClockIcon, label: "Reviews este mes", value: stats.reviewsThisMonth },
    { icon: ChartIcon, label: "Reviews este ano", value: stats.reviewsThisYear },
    ...(mostReviewed
      ? [{ icon: TrophyIcon, label: `Serie mais avaliada: ${mostReviewed.series.title}`, value: mostReviewed.reviewCount }]
      : [])
  ];

  return (
    <section className="space-y-4">
      <div>
        <h2 className="section-title">Estatisticas de reviews</h2>
        <p className="section-copy">O retrato da atividade como critico no inSeries.</p>
      </div>
      <FixedGrid mobile={2} tablet={4} desktop={4}>
        {tiles.map((tile) => (
          <div
            key={tile.label}
            className="flex flex-col gap-2 rounded-3xl border border-border bg-surface/70 p-4 transition duration-200 ease-out hover:-translate-y-1 hover:border-border-strong hover:shadow-raised"
          >
            <span className="flex h-9 w-9 items-center justify-center rounded-2xl bg-primary/12 text-primary-text">
              <tile.icon className="h-4.5 w-4.5" />
            </span>
            <p className="truncate text-2xl font-black text-ink">{tile.value}</p>
            <p className="truncate text-xs text-muted">{tile.label}</p>
          </div>
        ))}
      </FixedGrid>
    </section>
  );
}
