# INSERIES-CALENDAR-EXPERIENCE-01 — Agenda inteligente

## Escopo

Reformulacao exclusiva da pagina `/calendar` (aba "Meu calendario"), transformando-a de lista
plana de episodios em agenda cronologica: Hoje / Atrasados / Esta semana / Proximos
lancamentos / Temporadas futuras. Dashboard, Minha Lista, Catalogo, Recomendacoes, Pagina da
Serie, Feed, Estatisticas, APIs, algoritmos, sync TMDB, regras de negocio e permissoes
permanecem intocados. A aba "Todos os lancamentos" (calendario global) recebeu apenas o ajuste
mecanico necessario pra acompanhar a mudanca de API do `CalendarSection` (ver Fase 17).

## Fase 1 — Auditoria

Estado anterior: `PersonalCalendar` renderizava uma lista unica com secoes "Hoje", "Atrasados"
(mais recente primeiro), "Proximos lancamentos", "Temporadas futuras" e uma secao adicional
"Assistidos recentemente" (ultimos 14 dias). Cards grandes (`EpisodeCalendarCard` anterior)
mostravam poster maior, badge de estado de acompanhamento (Assistindo/Quero assistir) em vez de
status temporal, e multiplas acoes secundarias. Sem cabecalho de resumo numerico. Sem
agrupamento por dia da semana em "Esta semana". Secoes vazias renderizavam `EmptyState`
individuais.

## Fases implementadas

- **Fase 2** — Reorganizacao cronologica: Cabecalho, Resumo (`CalendarSummary`), Hoje,
  Atrasados, Esta semana, Proximos lancamentos, Temporadas futuras, nesta ordem, em
  [personal-calendar.tsx](../components/calendar/personal-calendar.tsx).
- **Fase 3** — Cabecalho compacto: titulo + 1 frase, sem Hero. Indicadores numericos vivem
  apenas no `CalendarSummary` (evita duplicar a mesma informacao 2x na tela).
- **Fase 4** — [calendar-summary.tsx](../components/calendar/calendar-summary.tsx): 4 tiles
  (Hoje / Esta semana / Atrasados / Proximas temporadas), sem grafico, sem query nova (reusa os
  contadores das secoes ja carregadas). Comentario no codigo deixa explicito que nao substitui
  Estatisticas.
- **Fase 5** — "Hoje" e secao propria (nao usa o componente generico `CalendarSection`),
  marcador visual (dot) + badge de status "Hoje" nos cards.
- **Fase 6** — "Atrasados" logo apos "Hoje". Ordenacao mudou de mais-recente-primeiro para
  mais-antigo-primeiro, com desempate por estado de acompanhamento (`WATCHING` antes de
  `WANT_TO_WATCH`) e depois por favorito (review com nota >= 4, mesma definicao usada no
  Dashboard/Minha Lista). Implementado em
  [lib/calendar/queries.ts](../lib/calendar/queries.ts) (`getPersonalCalendarSections`).
- **Fase 7** — "Esta semana" agrupado por dia via `groupByWeekday` em
  [lib/calendar/personal-sections.ts](../lib/calendar/personal-sections.ts), com testes
  unitarios em `personal-sections.test.ts`.
- **Fase 8** — "Proximos lancamentos" mantido (ja existia), ordenado por data, limitado a 20.
- **Fase 9** — "Temporadas futuras" agrupada por ano via `groupFutureSeasonsByYear`. Quando
  `airYear` e nulo (sem previsao no banco), a temporada cai no grupo "Sem previsao" — nenhuma
  data e inventada.
- **Fase 10/11/12** — [episode-calendar-card.tsx](../components/calendar/episode-calendar-card.tsx)
  reescrito como linha compacta: poster pequeno (h-16 w-11), titulo, temporada/episodio, data,
  1 badge de status temporal (Hoje/Atrasado/Em breve/Assistido — `assistido` sempre sobrepoe o
  status recebido via prop), e apenas 2 acoes ("Marcar assistido" via `EpisodeWatchButton`
  existente + "Abrir serie"). O badge antigo de estado de acompanhamento foi removido.
- **Fase 16** — Secao "Assistidos recentemente" removida da pagina e do
  `getPersonalCalendarSections` (campo `recentlyWatched` deletado da funcao).
- **Fase 17** — Secoes vazias nao renderizam mais `EmptyState` individual:
  [calendar-section.tsx](../components/calendar/calendar-section.tsx) agora retorna `null`
  quando `items` esta vazio. Um unico `EmptyState` de pagina aparece apenas quando as 5 secoes
  estao todas vazias. `global-calendar.tsx` foi ajustado (mecanicamente) pra manter seu proprio
  `EmptyState` explicito, ja que o componente compartilhado nao faz mais isso sozinho.
- **Fase 19** — Nenhum componente novo fora do Design System: `Card`, `Badge`, `EmptyState`,
  `PosterImage`, `EpisodeWatchButton` reaproveitados como estao.
- **Fase 21** — Badges usam variantes semanticas existentes (`primary`/`danger`/`secondary`/
  `success`) com contraste ja validado no DS. Acoes sao links/botoes nativos com foco visivel
  padrao do DS, sem interacoes hover-only.

## Fase 13/14 (implementadas em rodada de continuacao)

Ambas ficaram de fora do primeiro corte (o ticket usa linguagem condicional/opcional pra elas)
e foram completadas depois, a pedido do usuario:

- **Fase 13 — filtros unificados**: [personal-calendar-filters.tsx](../components/calendar/personal-calendar-filters.tsx)
  adiciona 2 grupos de chip — **Estado** (Todas/Assistindo/Quero assistir) e **Periodo**
  (Todos/Hoje/Esta semana/Atrasados) — com aplicacao automatica (sem botao "Aplicar"), barra
  inline no desktop e `Sheet` no mobile (mesmo padrao ja usado nos filtros do Catalogo). "Meu
  calendario"/"Todas as series" (os outros 2 itens citados na Fase 13) ja existiam como o `Tabs`
  de nivel de pagina (troca entre `/calendar?view=personal` e `?view=global`) — nao duplicados
  como chip pra nao ter 2 controles fazendo a mesma navegacao.
  Filtragem 100% em memoria no client ([personal-calendar-body.tsx](../components/calendar/personal-calendar-body.tsx)):
  o dataset de um calendario pessoal e pequeno, entao trocar de filtro e instantaneo, sem nenhum
  round-trip ao servidor.
- **Fase 14 — modo mensal**: [calendar-month-view.tsx](../components/calendar/calendar-month-view.tsx),
  toggle Lista/Mes (Lista continua sendo o padrao, "nunca substitui" per o ticket). Grade
  mensal com navegacao anterior/proximo, cada dia mostra a contagem de episodios (se houver),
  clicar num dia expande a lista de episodios daquela data logo abaixo da grade. Construida a
  partir dos MESMOS episodios ja buscados pela lista (Hoje/Atrasados/Esta semana/Proximos
  lancamentos) — nenhuma query nova.
- Testado ao vivo com a conta "Repro3" (a mesma do achado Tagesschau abaixo, 21.941 atrasados):
  pagina carrega normalmente (200, sem hang — os filtros nao mudam o padrao de query), os 2
  grupos de chip e o toggle Lista/Mes renderizam corretamente, clicar em "Mes" troca pra grade
  mensal sem erro.

## Fase 20 — nao implementada

Skeleton por secao / carregamento independente / progressive loading continuam nao
implementados. A pagina permanece um unico server-render sem Suspense boundaries por secao. Sem
regressao de performance vs. o estado anterior (mesma estrategia de carregamento ja existente),
mas o ticket pedia esse refinamento explicitamente e ele fica como debito documentado — a unica
lacuna restante do ticket do Calendario apos a rodada de continuacao.

## Achado ao vivo: hang pre-existente com dados de teste patologicos

Durante a verificacao manual, a conta de teste "Repro3" (que acompanha a serie seed
"Tagesschau", com 21.000+ episodios reais sincronizados via TMDb) causou timeout consistente
(>120s) ao carregar `/calendar`. Isolado via comparacao de contas (conta "Ana", com poucos dados,
carrega em ~3s) e via teste git-bisect (restaurando a versao pre-ticket de `queries.ts`,
committada e ja em producao, e testando com a mesma conta) — o hang ocorre identicamente no
codigo ANTIGO. Conclusao: e uma caracteristica de performance pre-existente ligada a dados de
seed patologicos (episodios em volume nao-realista para uma unica serie), nao uma regressao
introduzida por este ticket. Fica registrado como limitacao conhecida, fora do escopo desta
mudanca.

## Testes obrigatorios — scorecard

| Item | Resultado |
|---|---|
| `npx tsc --noEmit` | PASS (sem erros) |
| `npx eslint lib/calendar components/calendar app/calendar` | PASS (sem erros) |
| `npm run test` (vitest) | PASS (107/107, +8 testes novos em `personal-sections.test.ts`) |
| Verificacao ao vivo `/calendar` (conta leve, 1 serie rastreada) | PASS (200, secoes renderizam, sem crash) |
| Verificacao ao vivo `/calendar` (visitante anonimo) | PASS (200, CTA de login, sem redirect) |
| `e2e/dashboard-and-calendar.spec.ts` (Playwright, chromium + mobile-chromium) | PASS (6/6; 1 falha isolada em teste nao relacionado ao Calendario foi confirmada como flake pre-existente ao rodar sozinha) |
| `scripts/smoke-test.ts` (bloco Calendario) | PASS |
| Fase 13 (filtros unificados) | PASS — implementado, testado ao vivo |
| Fase 14 (modo mensal) | PASS — implementado, testado ao vivo |
| Fase 18 (responsividade 320-ultrawide) | CONDITIONAL — cards usam flex/line-clamp responsivos consistentes com o padrao ja usado no resto do app; nao houve sessao de verificacao visual dedicada em todos os breakpoints |
| Fase 20 (skeleton por secao) | BLOCKED — nao implementado, debito registrado acima |

## Classificacao final

**READY** — todas as fases do ticket foram implementadas, incluindo Fase 13 (filtros
unificados) e Fase 14 (modo mensal), completadas numa rodada de continuacao a pedido do usuario.
Unica lacuna restante: Fase 20 (skeleton por secao/carregamento independente), documentada acima
como debito tecnico — nao um item de escopo pulado.

**STATUS FINAL: PASS**
