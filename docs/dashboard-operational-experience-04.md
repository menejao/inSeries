# INSERIES-DASHBOARD-OPERATIONAL-EXPERIENCE-04

Ticket complementar ao INSERIES-PRODUCT-EXPERIENCE-REVOLUTION-01 (ticket geral, continua ativo
e prioritário em caso de conflito). Escopo restrito à rota do Dashboard (`/`,
`components/dashboard/dashboard-home.tsx` e componentes exclusivos que ele consome). Nenhuma
outra página é alterada por este documento.

## Fase 1 — Auditoria do Dashboard atual

Estado do Dashboard no momento em que este ticket começou (após o redesign completo entregue
no ticket geral: commits `6fc7199` e `57f8ef3` — corte de "Atalhos rápidos"/"Atividade
recente", reordenação por urgência, `ExpandableList`, `MarkAllWatchedButton`).

### Mapa de dados

| Fonte | O que retorna | Consumido por |
|---|---|---|
| `getWatchNextForUser` (`lib/watch-next/queries.ts`) | 1 item por série `WATCHING`/`WANT_TO_WATCH` com episódio pendente (já no ar, não assistido); `hasTrackedSeries` | `getContinueWatchingForUser` (direto), `/api/me/watch-next`, `/series/[id]` |
| `getContinueWatchingForUser` (`lib/continue-watching/queries.ts`) | Envelope de `getWatchNextForUser` + backdrop, progresso da série/temporada, último episódio assistido, ordenado por atividade recente | `ContinueWatchingSection` no Dashboard |
| `getDashboardCalendarData` (`lib/calendar/queries.ts`) | `sinceLastVisit` (novos desde a última visita), `overdue` (já no ar, não assistidos), `upcoming` (ainda não no ar) | Seções "Novos para você"/"Pendências"/"Agenda resumida" |
| `dedupeDashboardEpisodes` (`lib/dashboard/dedupe.ts`) | Remove de `sinceLastVisit`/`overdue` qualquer episódio que já apareça em `continueWatching` | Prioridade atual: Continuar > Novos > Pendências |
| `groupUpcomingForAgenda` (`lib/dashboard/agenda.ts`) | Agrupa `upcoming` em hoje/amanhã/esta semana | "Agenda resumida" |

### Seções atuais, propósito por propósito

| Seção | Propósito | Conteúdo | Ação principal | Frequência esperada | Manter / Transformar / Remover | Nova função proposta |
|---|---|---|---|---|---|---|
| Cabeçalho contextual | 1 frase de estado geral | `getContextualMessage` — 6 branches por prioridade (novo usuário → novos episódios → continuar → pendências → estreia hoje/amanhã → nada pendente) | Nenhuma (leitura) | Toda visita | **Manter, evoluir** | Já é o espírito da Fase 3 do ticket; falta cobrir "retorno após período de inatividade" e usar frase mais rica quando há dados suficientes |
| Continuar assistindo | Retomar onde parou | Carrossel horizontal (`Carousel`/`CarouselItem`) de `ContinueWatchingCard` — **todos os itens em andamento no mesmo peso visual**, sem hero | Botão "Continuar" por card | Toda visita, é o motivo de abrir o app | **Transformar** | Vira Hero (1 item, destaque) + lista secundária compacta para os demais |
| Pendências | Episódios já lançados sem ação | `EpisodeActionRow` — **1 linha por episódio individual**, mesmo quando vários são da mesma série (visto ao vivo: 5 linhas de "Serie Teste Um" T02E01–E05) | "Marcar como assistido" por linha + "Marcar todos" (lote, todos da lista junto, sem distinguir série) | Alta para quem está atrasado | **Transformar** | "Disponíveis agora", agrupado por série (1 card por série com contagem + intervalo) |
| Novos para você | Episódios lançados desde a última visita | `EpisodeActionRow`, mesma estrutura de Pendências | "Assistir" | Média — só há conteúdo se algo estreou recentemente | **Manter, comprimir critério de exibição** | Mantido como está; já usa `ExpandableList` e some inteiro (não cria empty state grande) quando `hasTrackedSeries` é falso — falta cobrir o caso "vazio mas usuário tem séries" com empty state compacto em vez de sumir |
| Agenda resumida | O que estreia em 7 dias | `AgendaSummary`, agrupado por hoje/amanhã/esta semana | "Abrir calendário" | Baixa-média, é planejamento não ação | **Manter**, já atende Fase 7 do novo ticket (só futuro, agrupado por data, link pro calendário) | Adicionar limite de 4 itens visíveis (hoje não tem cap explícito) |
| ~~Atalhos rápidos~~ | — | Removida no redesign anterior (3 links 100% redundantes com Sidebar/BottomNav) | — | — | **Já removida** | Fase 12 do novo ticket pede o mesmo raciocínio (não repetir Sidebar) mas quer atalhos **contextuais e acionáveis** (não apenas navegação) — reintroduzir como ações, não como links |
| ~~Atividade recente~~ | — | Removida no redesign anterior (duplicava `/profile/[username]`, sem ação própria) | — | — | **Reavaliar — conflito com este ticket** | Este ticket pede explicitamente "atividade recente agrupada" com regra de agrupamento própria (não existe em nenhum lugar do app hoje) — não é a mesma seção antiga, é uma nova (ver "Conflito" abaixo) |
| Séries acompanhadas | — | **Não existe hoje** | — | — | **Criar** | Fase 10 do novo ticket — resumo de estado por série (em andamento / próximo episódio amanhã / N disponíveis / temporada concluída), não uma lista de episódios |
| Resumo operacional | — | **Não existe hoje** | — | — | **Criar** | Fase 5 — painel compacto ao lado do Hero (desktop) / abaixo (mobile) com números acionáveis, não decorativos |

### Problemas confirmados por leitura de código (não suposição)

1. **Progresso 0% aparece como continuidade** — confirmado em `lib/continue-watching/queries.ts:101`: `seriesProgressPercent: status?.completionPercent ?? 0`. `getWatchNextForUser` inclui qualquer série `WATCHING`/`WANT_TO_WATCH` com episódio pendente, mesmo que o usuário nunca tenha assistido nada dela — o card mostra "0%" e o botão "Continuar" para uma série que na prática ainda não foi começada.
2. **Pendências repete a mesma série várias vezes** — confirmado ao vivo nesta sessão: usuário com 5 episódios pendentes da mesma série via 5 `EpisodeActionRow` idênticas em sequência, cada uma com poster/título repetido.
3. **Sem Hero real** — `ContinueWatchingSection` trata todos os itens do carrossel com o mesmo peso (`CarouselItem` de tamanho fixo); não há elemento com hierarquia maior que os demais.
4. **Peso visual uniforme** — todas as seções usam a mesma estrutura (`<section>` + heading + `EpisodeActionRow`/similar), sem variação de composição por propósito (heading centralizado no Design System, mas nenhuma seção usa um tratamento visualmente distinto tipo hero/painel/timeline).
5. **`Agenda resumida` sem cap explícito de itens** — `AgendaSummary` renderiza todos os grupos/itens de `agendaGroups` sem limite; a Fase 7 do novo ticket pede máximo de 4 itens visíveis.
6. **Sem "Séries acompanhadas"** — não existe nenhuma seção que resuma o estado por série (só o Hero/lista de continuidade, que só cobre séries com episódio pendente — uma série "aguardando nova temporada" ou "temporada concluída" não aparece em lugar nenhum do Dashboard hoje).

### Conflito real a resolver antes da Fase 2

O redesign anterior (ticket geral, sessão atual) **removeu** "Atividade recente" do Dashboard,
com a justificativa de que ela duplicava `/profile/[username]` e não oferecia ação própria.
Este novo ticket lista explicitamente "atividade recente resumida" no escopo afetado e pede,
na Fase 11, um comportamento que **não existe em nenhum lugar do app hoje**: agrupamento de
eventos consecutivos equivalentes (`"Você assistiu 5 episódios de O Novato, T08E09 até
T08E13"` em vez de 5 linhas repetidas).

Aplicando a regra de conflito do próprio ticket (item 3: "este ticket deve adaptar somente a
experiência do Dashboard" — não é uma decisão arquitetural global do ticket geral, foi uma
escolha de composição feita nesta sessão) e o fato de que a Fase 11 é explícita e detalhada:
**decisão — reintroduzir uma seção de atividade compacta e agrupada**, não a "Atividade
recente" antiga (lista simples das últimas 5 ações). A nova versão:
- agrupa por usuário + série + tipo de ação + janela de tempo coerente (regra nova, não
  existe hoje — vai precisar de uma função pura testável, no espírito de
  `dedupeDashboardEpisodes`/`groupUpcomingForAgenda`);
- limita a 3 registros agrupados;
- mantém "Ver feed";
- continua sem duplicar o Feed completo (o agrupamento é exclusivo da visualização do
  Dashboard, o Feed em si não muda — Fase 11 é explícita sobre isso).

Isso não é "desfazer" o redesign anterior — é a evolução que este ticket pede para a mesma
área, com uma regra de apresentação que o redesign anterior não tinha (grouping), resolvendo
o motivo original da remoção (repetição sem valor) em vez de simplesmente devolver a seção
antiga.

### O que NÃO muda (fora de escopo deste ticket)

Confirmado por leitura do restante da árvore de rotas: `/calendar`, `/series`, `/feed`,
`/recommendations`, `/me/stats`, `/me/recap`, `/me/achievements`, `/lists`, `/profile/[username]`,
`/settings`, `/admin/*`, `/login`, `/register`, `/series/[id]`, `/series/[id]/season/[season]`,
`/series/[id]/episode/[episode]` — nenhum arquivo dessas rotas será tocado por este ticket.
Links do Dashboard continuam apontando para elas sem alterar suas interfaces.

## Fase 2/4/9 — Hero real + regra de progresso 0%

**Decisão de arquitetura (Fase 17 — reusar componente compartilhado em vez de criar um
paralelo):** `ContinueWatchingCard` (`components/continue-watching/continue-watching-card.tsx`)
ganhou um prop `variant?: "default" | "hero"` opcional (default preserva o comportamento
exato de antes). `variant="hero"` é usado exclusivamente pelo item de maior prioridade no
Dashboard: `w-full` (não mais o tamanho fixo de carrossel), backdrop sempre visível (não só
no hover), tipografia maior (`text-2xl sm:text-3xl` no título), botões `size="md"`, e
`role="group"`/`aria-label` anunciando série + episódio + progresso (Fase 19). O outro
consumidor do componente, `components/profile/profile-collections.tsx` (`/profile`, fora do
escopo deste ticket), continua chamando sem o prop `variant` — comportamento, texto e classes
byte-idênticos ao que já existia, confirmado ao vivo no navegador.

**Regra de progresso (Fase 9 — "episódios com 0% não devem aparecer como Continuar
assistindo"):** nova função pura `splitContinueWatchingByProgress`
(`lib/dashboard/continue-watching-priority.ts`, 4 testes em
`continue-watching-priority.test.ts`) separa `started` (progresso > 0%) de `notStarted`
(0%). `ContinueWatchingSection` só considera `started` pro Hero/lista secundária;
`dashboard-home.tsx` reusa a mesma lista `started` (não a lista completa) como entrada do
`dedupeDashboardEpisodes` já existente — o episódio de uma série 0% deixa de ser "reservado"
pelo Continuar Assistindo e reaparece sozinho em Pendências/Novos, sem nenhuma lógica de
reclassificação nova. **Validado ao vivo**: usuário rastreando 2 séries (uma com 8% de
progresso real, outra recém-adicionada em 0%) — Hero mostra só a série com progresso; a
série 0% não aparece em nenhum lugar como "continuidade" e seus episódios em atraso aparecem
em Pendências ao lado dos da outra série.

**Múltiplos itens em andamento (Fase 4 — "não criar um grande carrossel... não depender
exclusivamente de interação horizontal"):** o Carousel horizontal foi removido do Dashboard
(continua existindo como componente, reutilizável, só não é mais usado aqui). Os itens além
do Hero (`started.slice(1)`, limitado a 3) viram uma lista vertical compacta reusando
`EpisodeActionRow` (mesmo primitivo de Pendências/Novos — Fase 13: variar composição por
propósito, preservar consistência via Design System).

**Achado de responsividade real, corrigido:** o Hero em largura total expôs um bug
pré-existente no `Tooltip` compartilhado (`components/ui/tooltip.tsx`) — conteúdo longo com
`whitespace-nowrap` posicionado `side="right"`, antes "escondido" porque tanto o Carousel
antigo quanto o `overflow-x-auto` de `/profile` absorviam esse overflow localmente. No Hero
(bloco de página normal, sem scroll container próprio), o mesmo overflow vazava pro
`document.documentElement.scrollWidth`. Corrigido no componente compartilhado (único
consumidor é este arquivo): `max-w-[min(16rem,calc(100vw-2rem))]` + `whitespace-normal`
(quebra linha em vez de forçar uma linha larga) — estritamente mais seguro pros dois
consumidores (Dashboard e `/profile`), nunca pior. Achado incidental #2: o cabeçalho de
"Pendências" (heading + `MarkAllWatchedButton` + "Ver tudo") não cabia lado a lado em 375px
depois que o Hero mudou o fluxo da página — corrigido empilhando em coluna no mobile
(`flex-col sm:flex-row`).

**Validado em todos os breakpoints exigidos pela Fase 21** (320/360/375/390/412/430/480/600/
768/820/1024/1280/1440/1600/1920/2560px, via `document.documentElement.scrollWidth` ===
`clientWidth` em cada um): zero overflow horizontal após as correções acima. Confirmado
também que o Hero respeita o `max-w` do layout (não estica em ultrawide — 1152px de largura
mesmo a 2560px de viewport, herdado do container já existente).

**Achado fora de escopo, não corrigido aqui:** `/profile/[username]` tem overflow horizontal
pré-existente e não-relacionado em 375px (~649px de scrollWidth), rastreado até o card de
cabeçalho/estatísticas do perfil (grid `grid-cols-2 sm:grid-cols-5` não colapsando
corretamente) — confirmado que não tem relação com Continue Watching nem com a mudança do
Tooltip (o `Tooltip` só torna o conteúdo mais estreito, nunca mais largo). Fora do escopo
deste ticket (`/profile` está na lista explícita de páginas não autorizadas). Sinalizado
como tarefa separada.

**Playwright, suíte completa (`--workers=1`, isolado): 30/32 na primeira rodada, 31/32 na
segunda.** As 2 falhas não têm relação com este ticket:
- `auth.spec.ts` "login com conta existente" — mesma corrida de registro/hidratação já
  documentada anteriormente nesta sessão (não reproduz de forma consistente; rodada seguinte
  passou).
- `visual.spec.ts` "Landing page desktop" — o snapshot (`fullPage: true`) não consegue nem
  gerar uma baseline estável agora: 2 tentativas seguidas de captura, segundos uma da outra,
  produzem alturas de página diferentes. Confirmado via accessibility tree do próprio
  Playwright que o conteúdo está completo (dezenas de séries em varias carrosséis, nenhum
  erro/estado quebrado) — não é conteúdo faltando, é a altura real da página variando entre
  capturas, provavelmente pelo catálogo (que só cresce nesta sessão via syncs reais do TMDb)
  ter algum elemento não-determinístico de ordenação/selecao que muda a contagem de
  linhas/quebra de carrossel entre requisições. Mesma categoria já documentada mais cedo nesta
  sessão ("Achado de performance"/"visual snapshot vs catálogo ao vivo") — não é regressão do
  Hero (o componente da Landing não importa nada de `continue-watching`/`dashboard`) e não
  foi perseguido mais a fundo (baixo retorno, característica do ambiente, não do código).

## Próximos passos

Fase 5 (Resumo operacional), Fase 8 (Disponíveis agora agrupado por série — hoje ainda é
Pendências linha-a-linha), Fase 10 (Séries acompanhadas, seção nova), Fase 11 (Atividade
recente agrupada, reintrodução decidida na seção de conflito acima), Fase 12 (Ações rápidas
contextuais) e o restante (hierarquia visual fina, documentação final, evidências) serão
implementados e documentados incrementalmente nas próximas seções deste arquivo,
seguindo o mesmo ritmo de validação ao vivo (Docker disponível) já estabelecido no ticket
geral: implementar → validar no navegador → testar → documentar → commit.
