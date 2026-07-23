import Link from "next/link";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { ExpandableList } from "@/components/ui/expandable-list";
import { EpisodeActionRow } from "@/components/dashboard/episode-action-row";
import { MarkAllWatchedButton } from "@/components/dashboard/mark-all-watched-button";
import { AvailableNowGroupCard } from "@/components/dashboard/available-now-group-card";
import { TrackedSeriesCard } from "@/components/dashboard/tracked-series-card";
import { OperationalSummary } from "@/components/dashboard/operational-summary";
import { AgendaSummary } from "@/components/dashboard/agenda-summary";
import { FixedGrid } from "@/components/ui/fixed-grid";
import { ContinueWatchingSection } from "@/components/continue-watching/continue-watching-section";
import { AlertCircleIcon, BellIcon, CalendarIcon, TvIcon } from "@/components/ui/icons";
import { getDashboardCalendarData } from "@/lib/calendar/queries";
import { getContinueWatchingForUser } from "@/lib/continue-watching";
import { getTrackedSeriesSummaryForUser } from "@/lib/tracked-series";
import { dedupeDashboardEpisodes } from "@/lib/dashboard/dedupe";
import { splitContinueWatchingByProgress } from "@/lib/dashboard/continue-watching-priority";
import { groupOverdueBySeries } from "@/lib/dashboard/group-by-series";
import { groupUpcomingForAgenda } from "@/lib/dashboard/agenda";
import { cn, formatRelativeDate } from "@/lib/utils";
import type { User } from "@prisma/client";

/**
 * Fase 8/10 (INSERIES-DASHBOARD-OPERATIONAL-EXPERIENCE-04) — "no maximo 3 [itens] no mobile, 4
 * no tablet, 5 no desktop" (limite explicito da Fase 8, reaproveitado pra Fase 10 pelo mesmo
 * raciocinio: "limitar a quantidade de itens"). Progressivo via CSS puro (indices 3/4 ficam
 * escondidos ate o breakpoint certo), sem estado de cliente - "Ver tudo" cobre o resto.
 */
function progressiveItemVisibility(index: number) {
  if (index === 3) return "hidden sm:block";
  if (index === 4) return "hidden lg:block";
  return undefined;
}

/**
 * Fase 3/8 — cabecalho contextual: uma frase, nunca metricas decorativas nem gamificacao.
 * "Usuario novo/sem series" (Fase 8) e o primeiro branch: sem isso, cai no fallback generico
 * "Nao ha lancamentos pendentes hoje" — tecnicamente verdade, mas confuso pra quem nunca
 * acompanhou nada (sugere que ha algo sendo monitorado, so que em dia).
 */
function getContextualMessage({
  hasTrackedSeries,
  newCount,
  hasContinueWatching,
  pendingCount,
  nextAgendaGroupKey
}: {
  hasTrackedSeries: boolean;
  newCount: number;
  hasContinueWatching: boolean;
  pendingCount: number;
  nextAgendaGroupKey: "hoje" | "amanha" | "estaSemana" | null;
}) {
  if (!hasTrackedSeries) {
    return "Bem-vindo ao inSeries! Explore o catalogo e comece a acompanhar suas series.";
  }
  if (newCount > 0) {
    return `Voce tem ${newCount} episodio${newCount > 1 ? "s" : ""} novo${newCount > 1 ? "s" : ""} desde sua ultima visita.`;
  }
  if (hasContinueWatching) {
    return "Continue de onde parou.";
  }
  if (pendingCount > 0) {
    return `Voce tem ${pendingCount} pendencia${pendingCount > 1 ? "s" : ""} esperando uma acao.`;
  }
  if (nextAgendaGroupKey === "hoje") return "Seu proximo episodio estreia hoje.";
  if (nextAgendaGroupKey === "amanha") return "Seu proximo episodio estreia amanha.";
  return "Nao ha lancamentos pendentes hoje.";
}

export async function DashboardHome({ user }: { user: Pick<User, "id" | "name" | "lastLoginAt"> }) {
  const lastVisitAt = user.lastLoginAt ?? new Date(Date.now() - 24 * 60 * 60 * 1000);
  const firstName = user.name.split(" ")[0];

  const [calendarData, continueWatching, trackedSeriesSummary] = await Promise.all([
    getDashboardCalendarData(user.id, lastVisitAt),
    getContinueWatchingForUser(user.id, { limit: 10 }),
    getTrackedSeriesSummaryForUser(user.id)
  ]);

  // Fase 9 (INSERIES-DASHBOARD-OPERATIONAL-EXPERIENCE-04) — series com 0% de progresso nao
  // contam como "continuidade" pro dedupe (Fase 7, INSERIES-DASHBOARD-HOME-EXPERIENCE-03):
  // sem isso, o episodio delas nunca apareceria em nenhuma secao (excluido daqui por estar
  // em `continueWatching`, mas tambem nao renderizado la porque o Hero/lista secundaria so
  // mostra `started`) - um buraco onde o episodio simplesmente desaparecia do Dashboard.
  const { started: continueWatchingStarted } = splitContinueWatchingByProgress(continueWatching.items);

  // Fase 7 — regra de exclusividade: Continuar Assistindo > Novos para voce > Pendencias > Agenda futura.
  const { sinceLastVisit, overdue } = dedupeDashboardEpisodes({
    continueWatching: continueWatchingStarted,
    sinceLastVisit: calendarData.sinceLastVisit,
    overdue: calendarData.overdue
  });
  const agendaGroups = groupUpcomingForAgenda(calendarData.upcoming);
  // Fase 8 — "Disponiveis agora": agrupado por serie em vez de 1 linha por episodio.
  const allAvailableNowGroups = groupOverdueBySeries(overdue);
  const availableNowGroups = allAvailableNowGroups.slice(0, 5);
  // Fase 10 — "Series acompanhadas": estado por serie, nao lista de episodios.
  const trackedSeriesItems = trackedSeriesSummary.slice(0, 5);

  // Fase 5 — "Resumo operacional": numeros com contexto (nunca so o numero), cada um linkado
  // pra secao/pagina correspondente. `tomorrowGroup` usa `episodes.length + hiddenCount` (nao
  // so `episodes.length`) porque `groupUpcomingForAgenda` trunca o array pra EXIBICAO (Fase
  // 7/8, INSERIES-DASHBOARD-HOME-EXPERIENCE-03) - contar so o array visivel sub-contaria,
  // o mesmo bug que ja foi achado e corrigido pra "Disponiveis agora" (Fase 8) nesta sessao.
  const tomorrowGroup = agendaGroups.find((group) => group.key === "amanha");
  const tomorrowCount = tomorrowGroup ? tomorrowGroup.episodes.length + tomorrowGroup.hiddenCount : 0;

  const contextualMessage = getContextualMessage({
    hasTrackedSeries: continueWatching.hasTrackedSeries,
    newCount: sinceLastVisit.length,
    hasContinueWatching: continueWatchingStarted.length > 0,
    pendingCount: overdue.length,
    nextAgendaGroupKey: agendaGroups[0]?.key ?? null
  });

  return (
    <div className="space-y-8">
      <div>
        <p className="eyebrow">Ola, {firstName}</p>
        <p className="section-copy mt-1 text-base text-ink sm:text-lg">{contextualMessage}</p>
      </div>

      <ContinueWatchingSection
        continueWatching={continueWatching}
        summary={
          continueWatching.hasTrackedSeries ? (
            <OperationalSummary
              lines={[
                {
                  count: overdue.length,
                  label: `episodio${overdue.length === 1 ? "" : "s"} ${overdue.length === 1 ? "disponivel" : "disponiveis"}`,
                  href: "#disponiveis-agora"
                },
                {
                  count: allAvailableNowGroups.length,
                  label: `serie${allAvailableNowGroups.length === 1 ? "" : "s"} em andamento`,
                  href: "#disponiveis-agora"
                },
                { count: tomorrowCount, label: `estreia${tomorrowCount === 1 ? "" : "s"} amanha`, href: "#agenda-resumida" }
              ]}
              ctaHref="/me/minha-lista"
              ctaLabel="Ver acompanhamento"
            />
          ) : undefined
        }
      />

      {/*
        Fase "redesign completo" (pedido do usuario, sessao com Docker/servidor ao vivo
        disponivel pela primeira vez) — hub operacional diario, nao um mural. Cortado:
        "Atalhos rapidos" (3 links pra Calendario/Feed/Series ja presentes na Sidebar e no
        BottomNav — navegacao pura, zero interacao, ocupava espaco sem info nova) e
        "Atividade recente" (timeline das proprias acoes do usuario, ja duplicada em
        /profile/[username] e sem nenhuma acao possivel a partir dela — /feed e /me/recap ja
        cobrem "o que eu fiz", esta pagina cobre "o que eu preciso fazer agora"). Ordem das
        secoes tambem virou por urgencia de acao: Pendencias (ja atrasado) antes de Novos (fresco,
        mas ainda nao urgente) e Agenda (futuro, so planejamento).
      */}
      {overdue.length > 0 ? (
        <section id="disponiveis-agora" className="scroll-mt-24 space-y-4" aria-label="Disponiveis agora">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
            <div>
              <h2 className="flex items-center gap-2 text-xl font-semibold text-ink">
                <AlertCircleIcon className="h-5 w-5 shrink-0 text-subtle" aria-hidden />
                Disponiveis agora
              </h2>
              <p className="section-copy mt-1">Episodios ja lancados que ainda pedem uma acao sua.</p>
            </div>
            <div className="flex shrink-0 items-center gap-3">
              {overdue.length > 1 ? (
                <MarkAllWatchedButton episodeIds={overdue.map((episode) => episode.id)} count={overdue.length} />
              ) : null}
              <Link href="/calendar" className="link-accent text-sm">
                Ver tudo
              </Link>
            </div>
          </div>
          <div className="flex flex-col gap-2">
            {availableNowGroups.map((group, index) => (
              <div key={group.series.id} className={cn(progressiveItemVisibility(index))}>
                <AvailableNowGroupCard group={group} />
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {/*
        Fase 8 (INSERIES-PRODUCT-EXPERIENCE-REVOLUTION-01) — "usuario novo"/"usuario sem
        series": sem nenhuma serie acompanhada, sinceLastVisit/overdue/upcoming sao sempre
        vazios por construcao (derivam de UserSeriesStatus). Empilhar 3 EmptyState repetindo
        "acompanhe uma serie" depois do CTA que ContinueWatchingSection ja mostra vira parede
        de cards vazios (proibido pelo ticket) — Novos/Agenda somem inteiras nesse caso.
      */}
      {continueWatching.hasTrackedSeries ? (
        <>
          <section className="space-y-4" aria-label="Novos para voce">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="flex items-center gap-2 text-xl font-semibold text-ink">
                  <BellIcon className="h-5 w-5 shrink-0 text-subtle" aria-hidden />
                  Novos para voce
                </h2>
                <p className="section-copy mt-1">Episodios de series que voce acompanha, lancados desde sua ultima visita.</p>
              </div>
              <Link href="/calendar" className="link-accent shrink-0 text-sm">
                Ver todos
              </Link>
            </div>
            {sinceLastVisit.length ? (
              <ExpandableList initialVisible={5} itemLabel="episodio" listClassName="flex flex-col gap-2">
                {sinceLastVisit.map((episode) => (
                  <EpisodeActionRow
                    key={episode.id}
                    episode={episode}
                    dateLabel={formatRelativeDate(episode.airedAt)}
                    badge={{ label: "Novo", variant: "success" }}
                    action={{ kind: "continue", label: "Assistir", href: `/series/${episode.series.slug}/episode/${episode.id}` }}
                  />
                ))}
              </ExpandableList>
            ) : (
              <Card>
                <EmptyState
                  icon={<BellIcon className="h-6 w-6" aria-hidden />}
                  title="Nenhum episodio novo"
                  copy="Quando uma serie que voce acompanha lancar um episodio, ele aparece aqui."
                />
              </Card>
            )}
          </section>

          <section id="agenda-resumida" className="scroll-mt-24 space-y-4" aria-label="Agenda resumida">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="flex items-center gap-2 text-xl font-semibold text-ink">
                  <CalendarIcon className="h-5 w-5 shrink-0 text-subtle" aria-hidden />
                  Agenda resumida
                </h2>
                <p className="section-copy mt-1">O que estreia nos proximos 7 dias.</p>
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

          {/*
            Fase 10 — "Series acompanhadas": estado por serie (nao lista de episodios), pra
            cobrir series que nao aparecem em nenhuma outra secao (nada pendente, nada
            estreando em 7 dias) - ex.: "Aguardando nova temporada"/"Temporada concluida".
            `trackedSeriesSummary` ja vem vazio quando `hasTrackedSeries` e falso, mas o
            `continueWatching.hasTrackedSeries ?` externo ja cobre isso - sem EmptyState
            redundante aqui.
          */}
          {trackedSeriesItems.length ? (
            <section className="space-y-4" aria-label="Series acompanhadas">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 className="flex items-center gap-2 text-xl font-semibold text-ink">
                    <TvIcon className="h-5 w-5 shrink-0 text-subtle" aria-hidden />
                    Series acompanhadas
                  </h2>
                  <p className="section-copy mt-1">O estado de cada serie que voce acompanha.</p>
                </div>
                <Link href="/me/minha-lista" className="link-accent shrink-0 text-sm">
                  Ver tudo
                </Link>
              </div>
              <FixedGrid mobile={1} tablet={2} desktop={3}>
                {trackedSeriesItems.map((item, index) => (
                  <div key={item.series.id} className={cn(progressiveItemVisibility(index))}>
                    <TrackedSeriesCard item={item} />
                  </div>
                ))}
              </FixedGrid>
            </section>
          ) : null}
        </>
      ) : null}
    </div>
  );
}
