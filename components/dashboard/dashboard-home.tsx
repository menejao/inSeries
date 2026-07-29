import Link from "next/link";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { AvailableNowGroupCard } from "@/components/dashboard/available-now-group-card";
import { AgendaSummary } from "@/components/dashboard/agenda-summary";
import { MarkAllWatchedButton } from "@/components/dashboard/mark-all-watched-button";
import { DashboardActivityRow } from "@/components/dashboard/dashboard-activity-row";
import { ContinueWatchingSection } from "@/components/continue-watching/continue-watching-section";
import { RecapWrappedBanner } from "@/components/dashboard/recap-wrapped-banner";
import { AlertCircleIcon, CalendarIcon, FilmIcon } from "@/components/ui/icons";
import { getDashboardCalendarData } from "@/lib/calendar/queries";
import { getContinueWatchingForUser } from "@/lib/continue-watching";
import { getRecentActivityForUser } from "@/lib/social/activity";
import { dedupeDashboardEpisodes } from "@/lib/dashboard/dedupe";
import { splitContinueWatchingByProgress } from "@/lib/dashboard/continue-watching-priority";
import { groupOverdueBySeries } from "@/lib/dashboard/group-by-series";
import { groupUpcomingForAgenda, type AgendaGroupKey } from "@/lib/dashboard/agenda";
import { canAccessRecapWrapped } from "@/lib/recap/window";
import { cn } from "@/lib/utils";
import type { User } from "@prisma/client";

/**
 * Fase 8/10 (INSERIES-DASHBOARD-OPERATIONAL-EXPERIENCE-04) — "no maximo 3 [itens] no mobile, 4
 * no tablet, 5 no desktop". Progressivo via CSS puro (indices 3/4 ficam escondidos ate o
 * breakpoint certo), sem estado de cliente - "Ver tudo" cobre o resto.
 */
function progressiveItemVisibility(index: number) {
  if (index === 3) return "hidden sm:block";
  if (index === 4) return "hidden lg:block";
  return undefined;
}

/**
 * Fase 3/8 (INSERIES-DASHBOARD-OPERATIONAL-EXPERIENCE-04) — cabecalho contextual: uma frase,
 * nunca metricas decorativas nem gamificacao.
 */
function getContextualMessage({
  hasTrackedSeries,
  pendingCount,
  hasContinueWatching,
  nextAgendaGroupKey
}: {
  hasTrackedSeries: boolean;
  pendingCount: number;
  hasContinueWatching: boolean;
  nextAgendaGroupKey: AgendaGroupKey | null;
}) {
  if (!hasTrackedSeries) {
    return "Bem-vindo ao inSeries! Explore o catalogo e comece a acompanhar suas series.";
  }
  if (pendingCount > 0) {
    return `Voce tem ${pendingCount} episodio${pendingCount > 1 ? "s" : ""} pendente${pendingCount > 1 ? "s" : ""} de marcar.`;
  }
  if (hasContinueWatching) {
    return "Suas series estao em dia. Continue acompanhando quando quiser.";
  }
  if (nextAgendaGroupKey === "hoje") return "Seu proximo episodio estreia hoje.";
  if (nextAgendaGroupKey === "amanha") return "Seu proximo episodio estreia amanha.";
  return "Nao ha lancamentos pendentes hoje.";
}

/**
 * INSERIES-DASHBOARD-AND-MY-LIST-EXPERIENCE-01 — evolucao incremental sobre
 * INSERIES-DASHBOARD-HOME-EXPERIENCE-03 (preservada onde nao ha conflito de escopo).
 * Principio central: "o Dashboard deve responder apenas: o que preciso fazer hoje?"
 * Mudancas desta sprint, documentadas em detalhe em
 * docs/dashboard-and-my-list-experience-01.md:
 *
 * - Fase 3/4: "Continuar acompanhando" virou "Assistir a seguir" - sem barra de progresso,
 *   porcentagem ou tooltip (Fase 3 - essas informacoes pertencem a Pagina da Serie/Estatisticas).
 * - Fase 5: ordenacao propria desta secao (hoje > ontem > favoritos > menor pendencia > resto).
 * - Fase 6: "Pendencias recentes" reduzida a poster + serie + contagem + 1 acao.
 * - Fase 7: "Proximos episodios" ganhou o grupo "Proxima semana".
 * - Fase 8: "Series acompanhadas" removida - redundante com "Assistir a seguir" +
 *   "Pendencias recentes" (toda serie acionavel ja aparece numa das duas).
 * - Fase 9: "Resumo semanal" adicionado e depois removido - achado ao vivo em producao
 *   apos o deploy: nao ficou bem junto ao resto do Dashboard, o proprio ticket ja tratava
 *   isso como opcional ("o Dashboard PODE possuir apenas um pequeno resumo semanal").
 * - Fase 10: "Atividade recente" reintroduzida, versao minima (sem agrupamento, max 3 itens).
 */
export async function DashboardHome({ user }: { user: Pick<User, "id" | "name" | "lastLoginAt" | "role"> }) {
  const lastVisitAt = user.lastLoginAt ?? new Date(Date.now() - 24 * 60 * 60 * 1000);
  const firstName = user.name.split(" ")[0];

  const [calendarData, continueWatching, recentActivity] = await Promise.all([
    getDashboardCalendarData(user.id, lastVisitAt),
    getContinueWatchingForUser(user.id, { limit: 10 }),
    getRecentActivityForUser(user.id, 3)
  ]);

  // Fase 9 (INSERIES-DASHBOARD-OPERATIONAL-EXPERIENCE-04) — series com 0% de progresso nao
  // contam como "continuidade" pro dedupe (Fase 7, INSERIES-DASHBOARD-HOME-EXPERIENCE-03).
  const { started: continueWatchingStarted } = splitContinueWatchingByProgress(continueWatching.items);

  const { sinceLastVisit, overdue } = dedupeDashboardEpisodes({
    continueWatching: continueWatchingStarted,
    sinceLastVisit: calendarData.sinceLastVisit,
    overdue: calendarData.overdue
  });
  const agendaGroups = groupUpcomingForAgenda(calendarData.upcoming);

  // Fase 6 (INSERIES-DASHBOARD-HOME-EXPERIENCE-03) — "Disponiveis agora" (ja atrasados) e
  // "Novos para voce" (lancados desde a ultima visita) comunicavam essencialmente a mesma
  // coisa: episodios que pedem uma acao. `dedupeDashboardEpisodes` ja garante que nenhum
  // episodio aparece nos dois arrays ao mesmo tempo, entao concatenar e seguro.
  const pendingEpisodes = [...overdue, ...sinceLastVisit];
  const allPendingGroups = groupOverdueBySeries(pendingEpisodes);
  const pendingGroups = allPendingGroups.slice(0, 5);

  const contextualMessage = getContextualMessage({
    hasTrackedSeries: continueWatching.hasTrackedSeries,
    pendingCount: pendingEpisodes.length,
    hasContinueWatching: continueWatchingStarted.length > 0,
    nextAgendaGroupKey: agendaGroups[0]?.key ?? null
  });

  const recapWrappedAvailable = canAccessRecapWrapped(user.role === "ADMIN");

  return (
    <div className="space-y-8">
      <div>
        <p className="eyebrow">Ola, {firstName}</p>
        <p className="section-copy mt-1 text-base text-ink sm:text-lg">{contextualMessage}</p>
      </div>

      {recapWrappedAvailable ? <RecapWrappedBanner /> : null}

      <ContinueWatchingSection continueWatching={continueWatching} />

      {pendingEpisodes.length > 0 ? (
        <section id="pendencias-recentes" className="scroll-mt-24 space-y-4" aria-label="Pendencias recentes">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
            <div>
              <h2 className="flex items-center gap-2 text-xl font-semibold text-ink">
                <AlertCircleIcon className="h-5 w-5 shrink-0 text-subtle" aria-hidden />
                Pendencias recentes
              </h2>
              <p className="section-copy mt-1">Episodios ja lancados que ainda pedem uma acao sua.</p>
            </div>
            <div className="flex shrink-0 items-center gap-3">
              {pendingEpisodes.length > 1 ? (
                <MarkAllWatchedButton episodeIds={pendingEpisodes.map((episode) => episode.id)} count={pendingEpisodes.length} />
              ) : null}
              <Link href="/calendar" className="link-accent text-sm">
                Ver tudo
              </Link>
            </div>
          </div>
          <div className="flex flex-col gap-2">
            {pendingGroups.map((group, index) => (
              <div key={group.series.id} className={cn(progressiveItemVisibility(index))}>
                <AvailableNowGroupCard group={group} />
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {/*
        Fase 8 (INSERIES-PRODUCT-EXPERIENCE-REVOLUTION-01) — "usuario novo"/"usuario sem
        series": sem nenhuma serie acompanhada, upcoming e sempre vazio por construcao.
      */}
      {continueWatching.hasTrackedSeries ? (
        <section id="agenda-resumida" className="scroll-mt-24 space-y-4" aria-label="Proximos episodios">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="flex items-center gap-2 text-xl font-semibold text-ink">
                <CalendarIcon className="h-5 w-5 shrink-0 text-subtle" aria-hidden />
                Proximos episodios
              </h2>
              <p className="section-copy mt-1">O que estreia nas proximas 2 semanas.</p>
            </div>
            <Link href="/calendar" className="link-accent shrink-0 text-sm">
              Abrir calendario
            </Link>
          </div>
          {agendaGroups.length ? (
            <AgendaSummary groups={agendaGroups} />
          ) : (
            <Card>
              <EmptyState
                icon={<CalendarIcon className="h-6 w-6" aria-hidden />}
                title="Nenhum lancamento previsto"
                copy="Assim que uma serie que voce acompanha tiver um episodio agendado, ele aparece aqui."
              />
            </Card>
          )}
        </section>
      ) : null}

      {/*
        Fase 10 — "Atividade recente" opcional: se oculta inteira quando nao ha nada (Fase
        16, "quando listas estiverem vazias, preferencialmente ocultar completamente a
        secao"), nunca mostra um Empty State pra isso.
      */}
      {recentActivity.length ? (
        <section className="space-y-3" aria-label="Atividade recente">
          <h2 className="flex items-center gap-2 text-base font-semibold text-ink">
            <FilmIcon className="h-4 w-4 shrink-0 text-subtle" aria-hidden />
            Atividade recente
          </h2>
          <div className="flex flex-col gap-2">
            {recentActivity.map((activity) => (
              <DashboardActivityRow key={activity.id} activity={activity} />
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}
