import Link from "next/link";
import { ContinueWatchingCard } from "@/components/continue-watching/continue-watching-card";
import { EpisodeActionRow } from "@/components/dashboard/episode-action-row";
import { EmptyState } from "@/components/ui/empty-state";
import { buttonVariants } from "@/components/ui/button";
import { CompassIcon, PlayIcon } from "@/components/ui/icons";
import { splitContinueWatchingByProgress } from "@/lib/dashboard/continue-watching-priority";
import type { ContinueWatchingResult } from "@/lib/continue-watching";

/** Fase 4 (INSERIES-DASHBOARD-OPERATIONAL-EXPERIENCE-04) — no more than this many secondary (non-hero) items. */
const MAX_SECONDARY_ITEMS = 3;

/**
 * Fase 4 (INSERIES-DASHBOARD-OPERATIONAL-EXPERIENCE-04) — o Dashboard's primeira area, agora
 * com hero real em vez de um carrossel de cards iguais (INSERIES-CONTINUE-WATCHING-EXPERIENCE-01,
 * substituido por este ticket). `splitContinueWatchingByProgress` (lib/dashboard) remove series
 * com 0% de progresso antes de qualquer selecao - elas nunca competem pelo hero nem aparecem
 * como "continuidade" (Fase 9); o dono do Dashboard (dashboard-home.tsx) reusa a MESMA lista
 * `started` pro dedupe, entao o episodio de uma serie 0% reaparece sozinho em
 * Pendencias/Novos, sem nenhuma logica de "reclassificacao" extra.
 *
 * O hero (`ContinueWatchingCard` variant="hero") e sempre o primeiro item de `started` (a
 * query ja ordena por atividade mais recente - Fase 3 de lib/continue-watching/queries.ts).
 * Os demais (Fase 4: "nao criar um grande carrossel... nao depender exclusivamente de
 * interacao horizontal") viram uma lista vertical compacta (`EpisodeActionRow`, mesmo
 * primitivo usado por Pendencias/Novos - Fase 13: variar composicao por proposito, mas
 * preservar consistencia via Design System), limitada a `MAX_SECONDARY_ITEMS`.
 */
export function ContinueWatchingSection({ continueWatching }: { continueWatching: ContinueWatchingResult }) {
  const { started } = splitContinueWatchingByProgress(continueWatching.items);
  const [hero, ...rest] = started;
  const secondary = rest.slice(0, MAX_SECONDARY_ITEMS);

  if (!hero) {
    return (
      <section className="space-y-4">
        <div>
          <h2 className="section-title">Continuar assistindo</h2>
          <p className="section-copy">Retome suas series exatamente de onde parou.</p>
        </div>
        <EmptyState
          icon={<PlayIcon className="h-6 w-6" />}
          title={continueWatching.hasTrackedSeries ? "Voce esta em dia com suas series" : "Voce ainda nao comecou nenhuma serie"}
          copy={
            continueWatching.hasTrackedSeries
              ? "Nao ha episodios pendentes agora. Quando um novo episodio for lancado, ele aparece aqui."
              : "Explore o catalogo e comece a acompanhar uma serie para ver seu progresso aqui."
          }
          action={
            <Link href="/series" className={buttonVariants({ variant: "primary" })}>
              <CompassIcon className="h-4 w-4" />
              Explorar catalogo
            </Link>
          }
        />
      </section>
    );
  }

  return (
    <section className="space-y-4">
      <h2 className="section-title">Continuar assistindo</h2>
      <ContinueWatchingCard item={hero} priority variant="hero" />
      {secondary.length ? (
        <div className="flex flex-col gap-2">
          {secondary.map((item) => (
            <EpisodeActionRow
              key={item.episode.id}
              episode={{
                id: item.episode.id,
                title: item.episode.title,
                number: item.episode.number,
                seasonNumber: item.episode.seasonNumber,
                series: { slug: item.series.slug, title: item.series.title, posterUrl: item.series.posterUrl }
              }}
              dateLabel={`${Math.round(item.seriesProgressPercent)}% assistida`}
              badge={{ label: "Em andamento", variant: "outline" }}
              action={{ kind: "continue", label: "Continuar", href: `/series/${item.series.slug}/episode/${item.episode.id}` }}
            />
          ))}
        </div>
      ) : null}
    </section>
  );
}
