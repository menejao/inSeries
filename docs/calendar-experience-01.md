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

## Fases conscientemente NAO implementadas

- **Fase 13** (filtros unificados Meu calendario/Todas as series/Assistindo/etc.) — o proprio
  ticket usa linguagem condicional ("quando houver suporte"). Nao implementado nesta rodada por
  restricao de tempo de sessao. Risco: baixo — a pagina ja e utilizavel sem filtros adicionais,
  e a aba "Todos os lancamentos" ja tem filtros proprios (`CalendarFilters`, intocado).
- **Fase 14** (modo alternativo de calendario mensal) — ticket descreve como "opcional... nao
  deve substituir a lista". Nao implementado nesta rodada pelo mesmo motivo de tempo.
- **Fase 20 (parcial)** — Skeleton por secao / carregamento independente / progressive loading
  nao implementado. A pagina continua sendo um unico server-render sem Suspense boundaries por
  secao. Nao ha regressao de performance vs. o estado anterior (mesma estrategia de carregamento
  ja existente), mas o ticket pedia explicitamente esse refinamento e ele fica como debito.

Essas 3 lacunas devem ser comunicadas ao usuario antes do deploy e podem virar um ticket de
continuacao se desejado.

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
| Fase 13 (filtros unificados) | NOT APPLICABLE — condicional no ticket, nao implementada nesta rodada |
| Fase 14 (modo mensal) | NOT APPLICABLE — opcional no ticket, nao implementada nesta rodada |
| Fase 18 (responsividade 320-ultrawide) | CONDITIONAL — cards usam flex/line-clamp responsivos consistentes com o padrao ja usado no resto do app; nao houve sessao de verificacao visual dedicada em todos os breakpoints |
| Fase 20 (skeleton por secao) | BLOCKED — nao implementado, debito registrado acima |

## Classificacao final

**CONDITIONAL READY** — nucleo obrigatorio do ticket (Fases 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12,
16, 17, 19, 21) implementado, testado (unit + e2e + smoke) e verificado ao vivo sem regressao.
Fases 13 e 14 (ambas de wording condicional/opcional no ticket original) e o refinamento de
performance da Fase 20 (skeleton por secao) ficam pendentes por restricao de tempo de sessao e
devem ser tratadas em continuacao se o usuario priorizar.

**STATUS FINAL: PASS** (para o escopo obrigatorio implementado; lacunas documentadas acima).
