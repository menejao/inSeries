# Auditoria de Produto — INSERIES-PRODUCT-EXPERIENCE-REVOLUTION-01, Fase 1

Data: 2026-07-21. Escopo: leitura/inventário apenas — nenhum código de aplicação foi alterado
nesta etapa. Este documento é o "inventário verificável" pedido pela Fase 1 do ticket e a base
para sequenciar as fases seguintes (2 em diante) em sessões futuras.

## Como ler este documento

- **Matriz de páginas**: as 33 rotas reais da aplicação (exclui `app/api/*`), cada uma com
  classificação, propósito, ações e problemas encontrados.
- **Matriz de componentes**: os 31 arquivos de `components/ui/`, classificados.
- **Achados estruturais**: cadeias de redundância entre páginas — o achado mais acionável desta
  auditoria, porque aponta exatamente onde a Fase 2 (arquitetura de informação) precisa decidir
  unificar, diferenciar ou remover.
- **Lacunas de infraestrutura**: o que o ticket pede (Storybook, testes automatizados, busca
  global, breadcrumbs) e não existe hoje — afeta diretamente quais fases são "apenas
  implementação" vs. "implementação + infraestrutura nova do zero".

## Matriz de páginas (33 rotas)

Legenda de classificação: **Manter** / **Redesenhar** / **Reestruturar** / **Unificar** /
**Dividir** / **Reposicionar** / **Descontinuar visualmente** / **Remover**.

| Rota | Classificação | Propósito | Ação principal | Problema/redundância encontrada |
| --- | --- | --- | --- | --- |
| `/` (Dashboard) | Manter, mas revisar com o novo Design System | Central diária: continuar, novo, pendente, agenda, atalhos | Continuar assistindo / marcar episódio | Já passou por 2 sprints de correção estrutural (HOME-EXPERIENCE-02/03); ponto de partida mais maduro do app hoje |
| `/watch-next` | Redesenhar + decidir fusão | Fila de "próximo episódio" por série acompanhada | Continuar/marcar episódio | Mesma fonte de dados (`getWatchNextForUser`) que o Dashboard e o card de "Continuar assistindo" da página da série — 3 UIs para a mesma fila (ver achado estrutural #1) |
| `/calendar` | Redesenhar (Fase 10 do ticket é explícita) | Linha do tempo de lançamentos, pessoal ou global | Alternar aba pessoal/global | View pessoal duplica "Agenda resumida" do Dashboard e o conceito de atrasados do Watch Next |
| `/series` | Manter estrutura, redesenhar visual | Catálogo — busca/filtro/descoberta de todo o acervo | Abrir série | `sort=discovery` se sobrepõe conceitualmente a `/recommendations` |
| `/series/[id]` | Redesenhar (Fase 12, papel central do produto) | Hub completo de uma série: status, progresso, temporadas, ações | Continuar / definir status | Reimplementa (por design, reusando serviços) o card de continue-watching que já existe em `/` e `/watch-next` |
| `/series/[id]/season/[season]` | Reestruturar (risco de tabela rígida no mobile, Fase 13) | Lista de episódios de uma temporada com status | Marcar episódio | Subconjunto de dado já mostrado (colapsado) na própria página da série |
| `/series/[id]/episode/[episode]` | Manter, revisão leve | Detalhe de um episódio | Alternar assistido | Essencialmente um drill-down da linha da temporada |
| `/feed` | Redesenhar (Fase 14) | Atividade social — pessoal ou global | Consumir feed / alternar aba | Painel de descoberta (trending) duplica `/series?sort=discovery` e `/recommendations`; "Atividade recente" do Dashboard é uma versão menor deste feed |
| `/recommendations` | Redesenhar (Fase 11) | Sugestões personalizadas | Abrir série sugerida | Mesmo motor alimenta a seção de recomendações da página da série e o bloco de descoberta de `/me/minha-lista` |
| `/lists` | Unificar candidato com `/me/lists` | Navegação pública de listas da comunidade | Criar lista (→ `/me/lists`) | Estrutura de card quase idêntica a `/me/lists`, só muda o escopo dos dados |
| `/lists/[id]` | Manter | Ver/gerenciar uma lista | Adicionar/remover série (dono) ou navegar (visitante) | Nenhuma redundância relevante — é o destino compartilhado de `/lists` e `/me/lists` |
| `/me` | Remover (manter só como redirect técnico) | Nenhum — redirect morto para `/` | — | Stub sem UI própria, existe só por compatibilidade de link antigo |
| `/me/watching` | Remover (manter só como redirect técnico) | Nenhum — redirect para `/me/minha-lista#grupo-watching` | — | Idem — página fragmentada antiga, substituída |
| `/me/completed` | Remover (manter só como redirect técnico) | Nenhum — redirect para `/me/minha-lista#grupo-completed` | — | Idem |
| `/me/watchlist` | Remover (manter só como redirect técnico) | Nenhum — redirect para `/me/minha-lista#grupo-want_to_watch` | — | Idem |
| `/me/minha-lista` | Manter, redesenhar (Fase 9) | Hub pessoal: 6 estados de acompanhamento, busca/filtro/ações em lote | Mudar status / ação em lote | Traz embutida uma versão mais leve de `/me/stats` e do bloco de descoberta de `/recommendations` |
| `/me/lists` | Reestruturar/unificar com `/lists` | Gerenciar listas próprias | Criar lista | Ver `/lists` — mesmo padrão visual, escopo "próprias" |
| `/me/stats` | Redesenhar (Fase 16) | Analytics completo do histórico do usuário | Nenhuma (leitura) | Dado (`getUserStats`-family) triplicado: aqui, embutido em `/me/minha-lista` e embutido em `/profile/[username]` |
| `/me/recap` | Redesenhar, diferenciar de Stats (Fase 17) | Índice de retrospectivas mensais/anuais | Abrir um período | Precisa de identidade editorial própria para não parecer "Stats de novo" |
| `/me/achievements` | Redesenhar (Fase 18) | Gamificação — badges/nível/pontos | Nenhuma (leitura) | Nenhuma redundância relevante — camada isolada |
| `/profile/[username]` | Redesenhar, reduzir duplicação de dado | Vitrine pública do progresso de um usuário | Editar perfil (dono) / seguir (visitante) | Reimplementa trechos de `/me/stats`, `/me/minha-lista`, `/lists`, `/feed` para a mesma pessoa |
| `/settings` | Reestruturar (Fase 19 pede agrupar por domínio) | Editar conta/perfil/preferências | Salvar alterações | Página única longa hoje — ticket pede Conta/Aparência/Notificações/Privacidade/etc separados |
| `/login` | Redesenhar (Fase 21), estrutura já correta | Autenticar | Enviar formulário | Nenhuma — compartilha `AuthForm` com `/register` (bom padrão já existente) |
| `/register` | Redesenhar (Fase 21), estrutura já correta | Criar conta | Enviar formulário | Idem |
| `/admin` + 8 subrotas | Redesenhar (Fase 20), manter estrutura | Operação/moderação da plataforma | Varia por subpágina (busca, moderar, disparar sync) | Tabelas administrativas espelham as públicas (`/series`, `/lists`, reviews) — duplicação esperada e aceitável num painel admin, não é um problema a resolver |

## Achados estruturais (redundância entre páginas)

Estes são os achados que a Fase 2 (arquitetura de informação) precisa resolver com uma decisão
explícita de unificar, diferenciar ou remover — não são bugs, são o produto tendo crescido por
sprints incrementais sem uma arquitetura de informação unificada.

1. **Fila "próximo episódio" existe em 3 lugares**: Dashboard (`Novos para você`/`Pendências`),
   `/watch-next` (página inteira dedicada), e o card de "Continuar assistindo" em
   `/series/[id]`. Todas as três leem de `getWatchNextForUser`/`getContinueWatchingForUser`
   (`lib/watch-next`, `lib/continue-watching`) — nenhuma lógica duplicada no *dado*, mas 3
   apresentações diferentes da mesma decisão "o que assistir agora". Fase 2 precisa decidir: a
   página `/watch-next` continua existindo como "ver tudo" do card do Dashboard, ou é
   descontinuada e a Sidebar aponta direto para o Dashboard?
2. **Conceito de agenda/atrasado existe em 3 lugares**: Dashboard "Agenda resumida", `/calendar`
   (view pessoal), e a noção de "atrasado" do Watch Next. Mesma base de dados
   (`lib/calendar/queries.ts`), 3 recortes de tempo diferentes sem uma hierarquia clara de qual
   é a fonte "completa" e qual é o "resumo".
3. **4 rotas mortas**: `/me`, `/me/watching`, `/me/completed`, `/me/watchlist` — só fazem
   `redirect()`, mantidas apenas por compatibilidade com links salvos de sprints anteriores.
   Candidatas a remoção real (não apenas visual) numa fase futura, com justificativa: zero
   funcionalidade própria, zero risco de regressão ao remover o arquivo de rota (o redirect em
   si pode virar uma regra no `middleware.ts`, se necessário manter compatibilidade sem manter
   4 arquivos de página).
4. **Listas públicas vs. próprias quase idênticas**: `/lists` e `/me/lists` usam
   essencialmente o mesmo layout de grid/card, diferindo só no filtro de dono. Candidato a
   unificação (uma rota com toggle "Minhas / Todas") em vez de duas páginas.
5. **Estatísticas triplicadas**: `/me/stats` (completo), resumo embutido em
   `/me/minha-lista`, resumo embutido em `/profile/[username]`. Mesma família de dado
   (`getUserStats`), 3 implementações de UI independentes — risco real de UI divergir com o
   tempo (uma sprint corrige um bug/formato só numa das três).
6. **Descoberta/trending triplicada**: painel de descoberta do `/feed`, `/series?sort=discovery`,
   e `/recommendations` — 3 superfícies de "o que está em alta" com enquadramentos diferentes,
   sem hierarquia declarada de qual é a fonte principal.
7. **Padrão que já está certo, não mexer sem motivo**: `/login`/`/register` compartilhando
   `AuthForm` (`mode="login"|"register"`) é exatamente o tipo de reuso que o resto do app
   deveria copiar — não é um problema, é um modelo a seguir.

## Matriz de componentes (`components/ui/`, 31 arquivos)

| Componente | Classificação | Observação |
| --- | --- | --- |
| Button / IconButton | Reutilizável | `variant` 5 opções, `size` xs/sm/md/lg — API madura, usado consistentemente |
| Badge | Reutilizável | 7 variantes semânticas |
| Card | Reutilizável | `padding`, `interactive`, `as` |
| Dialog / ConfirmDialog | Reutilizável | Focus trap, Escape/backdrop, já cobre boa parte da Fase 34 |
| Dropdown / DropdownItem / DropdownSeparator | Reutilizável | Único ponto de uso real hoje é `UserMenu`+`NotificationBellClient`+o Tooltip novo do Dashboard — subutilizado fora desses |
| EmptyState | Reutilizável | Só 1 tamanho — Fase 29 pede "espaço proporcional à importância", pode precisar de variante compacta |
| FixedGrid | Reutilizável | Classes fechadas (sem `grid-cols-${n}` dinâmico) — módulo mais consistente do app hoje |
| Skeleton (+ 6 variantes) | Reutilizável | Boa cobertura, mas `app/loading.tsx` da raiz é genérico (não reflete as seções reais do Dashboard — achado já registrado em sprint anterior) |
| Tooltip | Reutilizável, mas quase sem uso | Só usado hoje no card de Continuar Assistindo do Dashboard (adicionado na sprint 03) — API pronta, adoção baixíssima |
| Toast | Reutilizável | Duração fixa 4.5s não configurável por chamada — Fase 28 pede diferenciar feedback local/global, pode precisar de variante persistente |
| Progress | Reutilizável | Simples, `role="progressbar"` |
| Avatar | Reutilizável | 4 tamanhos |
| Input / Select / Checkbox / Radio / Switch / Textarea | Reutilizável | Formulário básico cobre o necessário; Select é wrapper fino sobre `<select>` nativo (sem busca/multi) |
| Table (Container/Table/Head/Body/Row/Th/Td) | Reutilizável com revisão | Primitivos existem, mas Fase 33 pede alternativa mobile (cards) — não confirmado se algum consumidor atual já faz isso |
| Tabs | Reutilizável com revisão | É navegação por pills orientada a rota (`items:{href,label}[]`), não um `role="tablist"` ARIA real — nomeação pode confundir na Fase 35 (acessibilidade) |
| Pagination | Reutilizável | Baseado em Link, simples |
| Alert | Reutilizável | 4 variantes, pouco explorado fora de contextos pontuais |
| Spinner | Reutilizável | Uso pontual, "somente em ações/áreas pequenas" (Fase 30) já é o padrão atual |
| SearchBar | Reutilizável com revisão | Existe e funciona no catálogo — não é um Command Palette (Fase 4 é 100% funcionalidade nova) |
| BarList / ColumnChart / DonutChart / Heatmap | Específico demais | Construídos especificamente para `/me/stats`; sem dependência externa (bom), mas API estreita — reuso fora de Stats não confirmado |
| icons.tsx | Reutilizável | Conjunto amplo, usado consistentemente |
| **Drawer** | **Ausente** | Ticket pede uso explícito (Fase 34) — não existe. `Sheet` (abaixo) cobre parte do papel |
| **Popover** | **Ausente** | Ticket pede uso explícito (Fase 34) — não existe |
| **Breadcrumb** | **Ausente** | Nenhuma implementação, nenhum uso — páginas profundas (`/series/[id]/season/[season]`) não têm trilha de navegação |
| Sheet | Reutilizável | Já existe: bottom sheet no mobile / modal centralizado no desktop — boa base para os papéis de Drawer/Sheet da Fase 34, mas nunca foi auditado como "Drawer" formalmente |

## Lacunas de infraestrutura (afetam quais fases são só implementação vs. implementação + infra nova)

- **Nenhum framework de teste existe**: sem Jest/Vitest/Testing Library (unitário/integração),
  sem Playwright/Cypress (E2E), sem Chromatic/Percy/Loki (regressão visual). O único mecanismo
  automatizado é `scripts/smoke-test.ts` (script HTTP + alguns testes puros pontuais, como o de
  deduplicação da sprint 03) — não é um framework, é um script escrito à mão. **Fases 46
  (testes visuais) e 47 (testes de fluxo automatizados) do ticket exigem infraestrutura nova do
  zero antes de qualquer teste poder ser escrito.**
- **Sem Storybook** (Fase 45): nenhum `.storybook/`, nenhuma dependência relacionada. Setup novo
  do zero.
- **Sem busca global / Command Palette** (Fase 4): existe `SearchBar` (busca de catálogo), mas
  nenhum command palette, atalho de teclado global, ou busca cross-domínio (séries + páginas +
  ações). Funcionalidade nova, não uma evolução de algo existente.
- **Sem breadcrumbs** (Fase 3): nenhuma implementação.
- **`prefers-reduced-motion` já respeitado globalmente via CSS** (`app/globals.css:155-164`,
  `@media` zera durações de animação/transição) — ponto positivo, não é uma lacuna.
- **Zero cor arbitrária fora dos tokens** (confirmado por grep) — o Design System atual já é
  disciplinado nesse aspecto; a Fase 5 é mais um trabalho de *nomear/documentar* os tokens
  existentes (`--c-surface`, `--c-ink` etc. já são semânticos) do que reconstruí-los do zero.
- **Sem `next/font`**: tipografia usa stack de fontes de sistema. Fase 6/7 (identidade
  editorial) implica uma decisão de produto sobre fonte própria — impacto em performance
  (carregamento de fonte) e identidade visual, não é uma mudança trivial de CSS.
- **Sidebar/BottomNav já são desacoplados e responsivos** (`lg:flex`/`lg:hidden`,
  colapsável com persistência em `localStorage`) — base sólida para a Fase 3, não precisa ser
  reconstruída do zero, só revisada.

## O que isso significa para sequenciar as próximas fases

Esta auditoria não implementa nada — é a base factual para decidir, com o usuário, por onde a
Fase 2 em diante deve começar. Pontos que exigem decisão explícita antes de qualquer código:

1. ~~As 4 rotas mortas (`/me`, `/me/watching`, `/me/completed`, `/me/watchlist`) são removidas
   de verdade (virando regra de `middleware.ts`) ou continuam como estão?~~ **Resolvido** — os
   4 `app/me*/page.tsx` (e o `loading.tsx` orfão de `/me`) foram apagados; o redirect virou
   `legacyRedirects` em `middleware.ts` (match exato de pathname, nunca prefixo — não
   intercepta `/me/minha-lista`, `/me/stats` etc). Login/registro (`app/api/auth/{login,
   register}/route.ts`) e `AuthForm` apontavam para `/me` como destino pós-autenticação — 
   atualizados para `/` direto, evitando um hop de redirect a mais. `scripts/smoke-test.ts`
   atualizado: os 3 checks de rota antiga verificavam antes um digest `NEXT_REDIRECT`
   embutido no HTML (porque o redirect rodava dentro de `app/me/loading.tsx`, um Suspense
   boundary); agora que o redirect é só do middleware, viraram checks de 307/302 real +
   header `Location`, mais simples e mais correto. Achado durante a limpeza: o atalho "Series
   acompanhadas" do Dashboard (sprint 03) ainda linkava para `/me/watching` em vez do destino
   final — corrigido para `/me/minha-lista#grupo-watching` direto.
2. ~~`/watch-next` continua como página própria ou é descontinuada em favor do Dashboard?~~
   **Resolvido** — descontinuada. `app/watch-next/` removido; `/watch-next` virou
   `legacyRedirects` em `middleware.ts` apontando para `/` (sem gate de auth próprio — `/`
   já trata anônimo vs. autenticado sozinho, então saiu de `protectedRoutes`). Removido de
   `Sidebar` e `BottomNav` (7→6 itens, `grid-cols-7`→`grid-cols-6`). O atalho "Marcar
   episodio" do Dashboard (sprint 03, apontava pra cá) foi removido — a ação já está
   evidente nas seções "Novos para você"/"Pendências" logo acima (`FixedGrid`
   `desktop={4}`→`desktop={3}`). A seção "Watch Next" do Perfil (só dono, duplicava
   "Continuar assistindo" na mesma página) também saiu, junto com o fetch
   `getWatchNextForUser` correspondente em `app/profile/[username]/page.tsx`.
   `components/watch-next/watch-next-card.tsx` ficou órfão (só tinha esses 2 consumidores)
   e foi apagado. `getWatchNextForUser`/`GET /api/me/watch-next` continuam existindo —
   ainda alimentam o Dashboard (via dedup), `/series/[id]` e o `WatchNextMarkButton`.
3. ~~`/lists` e `/me/lists` são unificados numa rota com toggle, ou permanecem separados?~~
   **Resolvido** — unificados em `/lists` com abas "Descobrir"/"Minhas listas"
   (`?view=minhas`), reusando o `Tabs` já usado por `/feed`/`/calendar`. `app/me/lists/`
   removido; `/me/lists` virou `legacyRedirects` em `middleware.ts` (mesmo padrão da
   decisão #1) apontando para `/lists?view=minhas`, preservando bookmarks antigos e o
   gate de autenticação que a rota já tinha. Achado incidental: `AddToListButton`
   ("Criar sua primeira lista", `components/series/add-to-list-button.tsx`) linkava para
   `/lists` (a view pública) em vez do destino de criação — bug pré-existente, corrigido
   como parte da unificação.
4. Testes automatizados (Fase 46/47) e Storybook (Fase 45) — investir em infraestrutura nova
   agora, ou adiar para depois da reformulação visual estar estável?
5. Fonte própria (Fase 6/7) — decisão de identidade visual que precisa de aprovação antes de
   qualquer implementação, não é algo para decidir sozinho.

**Fase 5 (Design System) — parcialmente resolvida.** A parte segura (documentar o que já
existe, sem decisão visual nenhuma) está em `docs/design-system.md`: tokens de cor mapeados
contra o vocabulário do ticket, catálogo dos 31 componentes de `components/ui/`, motion,
breakpoints, sombra/raio. Confirma o achado da Fase 1: a base já é semântica e sem cor
arbitrária — o trabalho real que falta (fonte própria, escala tipográfica, Drawer/Popover/
Breadcrumb/Command Palette) é o que a decisão #5 acima cobre.
