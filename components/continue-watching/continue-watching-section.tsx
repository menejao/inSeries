import Link from "next/link";
import { ContinueWatchingCard } from "@/components/continue-watching/continue-watching-card";
import { EmptyState } from "@/components/ui/empty-state";
import { FixedGrid } from "@/components/ui/fixed-grid";
import { buttonVariants } from "@/components/ui/button";
import { CompassIcon, TvIcon } from "@/components/ui/icons";
import { splitContinueWatchingByProgress } from "@/lib/dashboard/continue-watching-priority";
import { isSameDay, addDays } from "@/lib/calendar/dates";
import type { ContinueWatchingItem, ContinueWatchingResult } from "@/lib/continue-watching";

/**
 * Fase 4 (INSERIES-DASHBOARD-HOME-EXPERIENCE-03) — "e proibido exibir apenas uma serie em um
 * card hero gigante quando existirem varias series elegiveis... 3 ou mais series elegiveis:
 * continuar utilizando o FixedGrid existente". Cap inicial pra nao virar lista infinita
 * ("Muitas series em andamento: exibir quantidade limitada, disponibilizar Ver todas").
 */
const MAX_ITEMS = 6;

/**
 * Fase 5 (INSERIES-DASHBOARD-AND-MY-LIST-EXPERIENCE-01) — ordenacao especifica desta secao
 * (nao a ordem padrao de `getContinueWatchingForUser`, que outros consumidores como
 * `/profile/[username]` continuam usando sem alteracao): lancado hoje > lancado ontem >
 * favoritos > menor quantidade de episodios pendentes > resto (ordem ja recebida da query,
 * mais recente primeiro). Reordena so a lista local desta secao, nunca a query compartilhada.
 */
function sortForAssistirASeguir(items: ContinueWatchingItem[]) {
  const now = new Date();
  const yesterday = addDays(now, -1);

  function tier(item: ContinueWatchingItem) {
    if (isSameDay(item.episode.airedAt, now)) return 0;
    if (isSameDay(item.episode.airedAt, yesterday)) return 1;
    if (item.isFavorite) return 2;
    return 3;
  }

  return [...items].sort((a, b) => {
    const tierDiff = tier(a) - tier(b);
    if (tierDiff !== 0) return tierDiff;
    return a.pendingAfterNext - b.pendingAfterNext;
  });
}

/**
 * Fase 4 (INSERIES-DASHBOARD-HOME-EXPERIENCE-03) — "Continuar acompanhando" (nome anterior,
 * "Continuar assistindo", sugeria reproducao dentro do sistema - o inSeries nao e uma
 * plataforma de streaming). Antes: 1 hero gigante + lista secundaria compacta. Agora: TODAS
 * as series elegiveis (ate `MAX_ITEMS`) entram no MESMO `FixedGrid`, mesma largura/altura/
 * posicao de imagem/titulo/progresso/acoes por construcao (regra global de layout) - 1 serie
 * ocupa 1 celula do grid (nao a largura toda), 2+ ficam lado a lado quando o breakpoint
 * permitir. `splitContinueWatchingByProgress` (lib/dashboard) continua removendo series com
 * 0% de progresso antes de qualquer selecao (Fase 9, INSERIES-DASHBOARD-OPERATIONAL-EXPERIENCE-04)
 * - regra de elegibilidade reaproveitada, nao recriada.
 */
export function ContinueWatchingSection({ continueWatching }: { continueWatching: ContinueWatchingResult }) {
  const { started } = splitContinueWatchingByProgress(continueWatching.items);
  const ordered = sortForAssistirASeguir(started);
  const items = ordered.slice(0, MAX_ITEMS);

  if (!items.length) {
    return (
      <section className="space-y-4">
        <div>
          <h2 className="section-title">Assistir a seguir</h2>
          <p className="section-copy">Series acompanhadas com episodios disponiveis.</p>
        </div>
        <EmptyState
          icon={<TvIcon className="h-6 w-6" />}
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
      <div className="flex items-start justify-between gap-4">
        <h2 className="section-title">Assistir a seguir</h2>
        {ordered.length > MAX_ITEMS ? (
          <Link href="/me/minha-lista" className="link-accent shrink-0 text-sm">
            Ver todas
          </Link>
        ) : null}
      </div>
      <FixedGrid mobile={1} tablet={2} desktop={3}>
        {items.map((item, index) => (
          <ContinueWatchingCard key={item.episode.id} item={item} priority={index === 0} variant="hero" />
        ))}
      </FixedGrid>
    </section>
  );
}
