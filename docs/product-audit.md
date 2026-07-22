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

- ~~**Nenhum framework de teste existe**~~ **Resolvido** (ver decisão #4 mais abaixo) — Vitest
  (unitário, 38 testes rodando de verdade) e Playwright (E2E + regressão visual, instalado e
  com specs validados via `--list`, mas ainda não executados de fato — falta servidor/banco).
  `scripts/smoke-test.ts` continua existindo e útil (cobre fluxo HTTP completo com mutação de
  dado real), não foi substituído.
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
4. ~~Testes automatizados (Fase 46/47) e Storybook (Fase 45) — investir em infraestrutura nova
   agora, ou adiar para depois da reformulação visual estar estável?~~ **Parcialmente
   resolvido** — testes automatizados atacados; Storybook (Fase 45) fica pra depois (é um
   investimento separado, cadastrar cada componente com variantes/estados — não decidi puxar
   isso agora sem pedido explícito).
   - **Vitest** (`vitest.config.ts`, `npm run test`) — primeiro framework de teste unitário
     real do projeto. 38 testes cobrindo as funções puras que já existiam sem cobertura:
     `lib/dashboard/dedupe.ts` (regra de exclusividade da sprint 03), `lib/dashboard/agenda.ts`
     (agrupamento hoje/amanhã/semana), `lib/calendar/dates.ts`, `lib/utils.ts`. **Rodei de
     verdade** (`npm run test`) — 38/38 passando, evidência real, não só leitura de código. No
     processo, achei e corrigi um teste próprio frágil por timezone (episódio no limite exato
     dos 7 dias, `startOfDay`/`addDays` zeram hora local, não UTC).
   - **Playwright** (`playwright.config.ts`, `e2e/`, `npm run test:e2e`) — E2E + regressão
     visual. 7 specs / 36 casos (2 projects: `chromium` + `mobile-chromium`) cobrindo os
     fluxos obrigatórios do ticket: login/registro, encontrar série, começar a acompanhar,
     marcar episódio, Dashboard, calendário, listas (rota unificada `/lists?view=minhas`),
     navegação por teclado, ausência de scroll horizontal em 320/375px, e um spec de
     regressão visual (`e2e/visual.spec.ts`) estabelecendo o padrão. Chromium baixado e
     instalado (`npx playwright install chromium`) — confirmado funcional. **Bloqueado de
     rodar de verdade** (mesma razão de sempre: Docker Desktop indisponível, sem
     servidor+banco). Validação possível sem servidor: `npx playwright test --list` — os 36
     casos carregam/compilam corretamente (achei e corrigi um erro real nesse passo: um
     `test.use(devices[...])` dentro de um `describe` não é permitido pelo Playwright, movido
     para spec próprio).
5. ~~Fonte própria (Fase 6/7) — decisão de identidade visual que precisa de aprovação antes de
   qualquer implementação, não é algo para decidir sozinho.~~ **Resolvido** — usuário delegou
   a escolha. `Fraunces` (serif editorial, variável) para display/títulos + `Inter` (grotesca
   neutra) para o resto da UI, ambas via `next/font/google` em `app/layout.tsx`
   (self-hosted, zero requisição externa, sem layout shift — resolve de brinde parte da Fase
   37/performance). `Inter` já estava *citada* dentro da stack de sistema em
   `tailwind.config.ts` mas nunca carregada de verdade — essa decisão ativa uma intenção que
   já existia, não é um pivô aleatório. `tailwind.config.ts` ganhou `fontFamily.display`;
   `.section-title` (`app/globals.css`, usado como título principal em praticamente toda
   página) e o título do Hero da Landing (`components/landing/cinematic-hero.tsx`) usam
   `font-display` agora. Build confirmado gerando os `.woff2` self-hosted (10 arquivos em
   `.next/static/media`). **Não validado visualmente** — Docker indisponível, sem servidor
   pra ver o resultado renderizado; só a mecânica (fontes carregam, build passa) foi
   confirmada.

**Fase 5 (Design System) — resolvida na parte que não precisa de infraestrutura nova.**
`docs/design-system.md`: tokens de cor mapeados contra o vocabulário do ticket, catálogo dos
31 componentes de `components/ui/`, motion, breakpoints, sombra/raio, e agora a decisão de
tipografia acima. Lacunas reais que sobram (Drawer, Popover, Breadcrumb, Command Palette)
exigem construir componente novo, não só documentar — ficam para quando essas fases forem
atacadas de verdade.

**Fase 3 (Navegação mobile) — parcialmente resolvida.** O ticket pede explicitamente "no
máximo cinco destinos principais" com um item "Mais" pra ações secundárias — `BottomNav`
(`components/layout/bottom-nav.tsx`) tinha 7 (incluindo "Perfil", redundante: o avatar no
`DashboardHeader` já fica visível em toda largura de tela, inclusive mobile, e abre
Perfil/Configurações/Sair). Reduzido a 4 primários (Início, Acompanhar → `/me/minha-lista`,
Calendário, Séries) + "Mais" (`Sheet`, com Feed/Listas/Recomendações/Estatísticas/Recap/
Conquistas). Ganhou de brinde o que faltava desde a Fase 1: estado ativo (`aria-current`) —
antes não existia nenhuma lógica de item ativo no mobile. `isNavItemActive`
(`lib/utils.ts`, com teste em `lib/utils.test.ts`) extraído da Sidebar pra ser compartilhado
entre os dois, em vez de duplicar a mesma regra. **Não validado visualmente** — mesma
limitação de sempre.

**Fase 4 (Busca Global / Command Palette) — resolvida.** Era 100% ausente (confirmado na
Fase 1). Achado que acelerou tudo: `GET /api/search?type=all` já existia e já fazia busca
multi-domínio (séries via `searchProvider`, usuários/listas/reviews via
`lib/discovery/search.ts`) com rate limit — só nunca tinha sido exposta como Command Palette,
só usada nos filtros de `/series`. Zero lógica de busca nova, só UI nova em cima do que já
existia.

- `components/search/command-palette.tsx` — abre via `Ctrl/Cmd+K` global (listener em
  `window`) ou pelo evento customizado `OPEN_COMMAND_PALETTE_EVENT` (disparado pelo botão de
  busca do `DashboardHeader`) — decoupled porque trigger e palette vivem em subárvores React
  diferentes dentro do `DashboardShell`. Tem: ações rápidas (query vazia — calendário, feed,
  minhas listas, catálogo, configurações), busca com debounce de 250ms + `AbortController`,
  resultados agrupados por tipo (Séries/Usuários/Listas/Reviews), navegação por teclado
  (setas + Enter, além do clique/hover), histórico de buscas recentes (`localStorage`,
  mesmo padrão do `collapsed` da Sidebar), loading/erro/empty state.
- `Dialog` (`components/ui/dialog.tsx`) ganhou `size` (`md` default idêntico a antes, `lg`
  para o palette) e `padded` (permite conteúdo full-bleed, como o input de busca com borda
  própria) — os dois únicos outros usos de `Dialog` (`ConfirmDialog`) não passam nenhum dos
  dois, então o comportamento deles não muda.
- `e2e/command-palette.spec.ts` — 5 casos novos (abrir por atalho, abrir pelo botão, navegar
  e fechar, Escape fecha, busca mostra resultado agrupado ou empty state). Mesma limitação de
  execução dos outros specs: carrega certo via `--list` (46 casos totais agora), não rodou de
  verdade por falta de servidor.
- **Não validado visualmente** — mesma limitação de sempre (Docker indisponível).

**Fase 19 (Perfil e Configurações) — resolvida na parte com dado real.** `/settings` era 1
formulário só (`ProfileSettingsForm`): avatar+nome+username+bio+6 toggles de privacidade,
1 botão "Salvar" pra tudo junto. Auditoria (Fase 1) já tinha marcado isso como o problema
literal que a Fase 19 descreve ("página única longa"). `PATCH /api/profile` já aceitava
payload parcial (todo campo `.optional()` em `lib/social/validation.ts`) — não foi preciso
endpoint novo, só separar os formulários:

- `components/social/profile-details-form.tsx` (nome/username/bio/avatar) +
  `components/social/profile-privacy-form.tsx` (6 toggles) substituem o form único
  (`profile-settings-form.tsx` apagado). Cada um salva só o próprio domínio — editar
  privacidade não precisa mais reenviar nome/username/bio junto.
- `/settings` (`app/settings/page.tsx`) reescrita com `Tabs` (`?tab=`, mesmo padrão de
  `/feed`/`/calendar`): Perfil (default) / Privacidade / Aparência / Conta.
- **Deliberadamente não criadas** as abas Notificações/Segurança/Dados/Integrações/
  Acessibilidade que o ticket sugere — nenhuma delas tem dado ou funcionalidade real por
  trás hoje; criar aba vazia seria interface desonesta, não simplificação. Ficam para quando
  a funcionalidade de base existir.
- `e2e/settings.spec.ts` — 4 casos novos (aba padrão, trocar aba sem sair da rota, aba
  Aparência, e uma verificação real de que salvar Perfil não mexe nos toggles de
  Privacidade — a razão de separar os forms em primeiro lugar). 54 casos totais agora,
  carregando certo via `--list`.
- **Não validado visualmente** — mesma limitação de sempre.

**Fase 8 (Home/Dashboard — conteúdo adaptativo por estado) — resolvida na parte que faltava.**
O Dashboard já tinha passado por 2 sprints dedicados antes deste ticket
(HOME-EXPERIENCE-02/03) — estrutura de seções e dedup já resolvidos. O que a Fase 8 pede e
ainda faltava: adaptar conteúdo pelo *estado do usuário* (novo/sem séries, com pendências,
sem pendências, etc), não só pela presença/ausência de dado por seção isolada.

- Achado real: usuário sem nenhuma série acompanhada via 3 `EmptyState` empilhados dizendo
  a mesma coisa de formas diferentes ("Continuar assistindo" já tem CTA "Explorar catálogo",
  mas "Novos para você" e "Agenda resumida" mostravam outro `EmptyState` cada — **proibido
  explicitamente pelo ticket** ("Não criar uma parede de cards"), porque essas duas seções
  são sempre vazias por construção quando `hasTrackedSeries` é falso (derivam de
  `UserSeriesStatus`, que não existe pra esse usuário).
- `dashboard-home.tsx`: "Novos para você"/"Agenda resumida" agora somem inteiras (não só o
  conteúdo — a seção toda) quando `continueWatching.hasTrackedSeries` é falso. Sobra
  Continuar Assistindo (com seu CTA) + Atividade recente (pode ter atividade de outros
  usuários, útil mesmo sem série própria) + Atalhos rápidos — 3 seções em vez de 6 pro
  primeiro acesso.
- Cabeçalho contextual (`getContextualMessage`) ganhou o branch que faltava: sem isso, um
  usuário novo caía no fallback "Não há lançamentos pendentes hoje" — tecnicamente certo,
  mas engana (sugere que há algo sendo acompanhado, só que em dia). Agora é "Bem-vindo ao
  inSeries! Explore o catálogo e comece a acompanhar suas séries."
- `e2e/dashboard-new-user.spec.ts` (2 casos) + 2 checks novos em `scripts/smoke-test.ts`
  (reaproveitando o usuário `usercwempty` que já existia pra outro teste) — 58 casos E2E
  totais agora.
- **Não validado visualmente** — mesma limitação de sempre.

**Fase 9 (Acompanhamento) — já madura, sem ação.** `/me/minha-lista` já tinha, antes deste
ticket, tudo que a Fase 9 pede explicitamente: 6 grupos (`WATCHING`/`WANT_TO_WATCH`/
`PAUSED`/`COMPLETED`/`DROPPED`/`FAVORITES`), busca, filtro, ordenação e ações em lote
(`MyListToolbar`/`MyListBulkBar`). Não fiz mudança aqui — o gap real que sobra
(`MyListStatsSection`/`MyListDiscoverySection` duplicando `/me/stats`/`/recommendations`,
já achado #5/#6 da auditoria) é uma decisão de unificação maior, não um bug pontual.

**Fase 10 (Calendário) — parcialmente resolvida.** Achado real: 3 das 6 seções do calendário
pessoal (`Atrasados`, `Próximos Lançamentos`, `Assistidos Recentemente`) empilhavam
`EpisodeCalendarCard` (card cheio, poster+badge+ações) sem limite — `Atrasados` nem tinha
cap na query (`getPersonalCalendarSections`, `lib/calendar/queries.ts`), podia crescer sem
fim pra quem está muito atrasado. Exatamente a "grade ilegível"/"lista vertical muito longa"
que o ticket pede pra evitar (Fase 10/25). O calendário global já tinha visualizações
Hoje/Semana/Mês (`Tabs` em `components/calendar/global-calendar.tsx`) — a parte de
"oferecer visualizações adequadas" já estava feita, só faltava o limite de itens.

- `components/ui/expandable-list.tsx` — primitivo novo do Design System: mostra os N
  primeiros itens (dado já carregado pelo Server Component, nenhuma query nova) + um
  "Mostrar mais" que revela o resto no cliente, sem cortar dado de verdade.
- `CalendarSection` (`components/calendar/calendar-section.tsx`) ganhou `initialVisible`
  opcional — aplicado em `Atrasados`/`Próximos Lançamentos`/`Assistidos Recentemente`
  (pessoal, 5 cada) e `Lançamentos` (global, 10).
- Achado incidental corrigido: `scripts/smoke-test.ts` tinha um check checando
  `"Proximos episodios"` no Dashboard — texto renomeado pra "Agenda resumida" desde a
  sprint 03 (INSERIES-DASHBOARD-HOME-EXPERIENCE-03), nunca atualizado, ficaria falhando
  desde então se o smoke test rodasse de verdade.
- **Não fiz** as visualizações agenda/semana/mês completas com grid de datas — mudança
  maior, mais arriscada sem servidor pra validar visualmente. Ficou pra uma sessão com
  Docker disponível.
- `e2e/calendar.spec.ts` (3 casos) — 64 casos E2E totais agora.
- **Não validado visualmente** — mesma limitação de sempre.

**Fase 11 (Catálogo e Descoberta) — já madura, sem ação.** `/series` já tem busca/filtro/
ordenação/paginação real (`Filters`, `Pagination`, `DEFAULT_PAGE_SIZE=12`). `/recommendations`
já explica o motivo de cada sugestão — `RecommendationCard` mostra `primaryReason` (vem do
motor de recomendações, `lib/recommendations/scoring.ts`, nunca inventado na UI) — exatamente
o que a Fase 11 pede ("porque você acompanha X", etc). Nenhuma mudança necessária.

**Fase 13 (Temporadas/Episódios) — avaliada ao vivo, sem ação.** O risco apontado na Fase 1
("tabela rígida no mobile") era leitura estática — checado ao vivo agora (Docker disponível):
`/series/[id]/season/[season]` já renderiza `EpisodeRow` como card flex (`flex-col` no
mobile, `flex-row` em `sm:`), não tabela. Confirmado em 375px: `scrollWidth === clientWidth`
(zero overflow horizontal), 5 episódios renderizando corretamente. Já resolvido por uma
sprint anterior (`INSERIES-SERIES-PAGE-PREMIUM-01`, comentário no próprio componente) antes
deste ticket começar.

**Fase 35 (Acessibilidade), checagem pontual do `Tabs` — sem ação.** A dúvida da Fase 1 era
se nomear o componente "Tabs" sem ser um `role="tablist"` real confundiria a auditoria de
a11y. Lendo o componente: já é o padrão correto pra navegação orientada a rota (`<nav
aria-label>` + `<Link aria-current="page">`, não uma fake tablist) — exatamente o que o
WAI-ARIA APG recomenda pra esse caso (tablist real é pra alternar painéis sem navegar,
não é o caso aqui). Comentário no próprio arquivo já documenta a decisão. Nenhum bug de
verdade, só nomenclatura que já tem uma explicação clara ao lado.

**Fase 12 (Página da Série) — avaliada, achado pontual corrigido.** A página é a mais rica do
app (hero, ações contextuais, progresso, temporadas, próximo lançamento, produção, timeline,
reviews, listas, recomendações) e já segue boa parte do que a Fase 12 pede: ação contextual em
destaque no hero ("Continuar assistindo" só aparece quando há o quê continuar), metadados TMDB
compactados numa `ProductionSection` só-quando-tem-dado (`Card` inteira retorna `null` se
nenhum campo existe), nunca dominando a tela. Redesenho completo da página é risco grande demais
pra tentar sem servidor pra validar visualmente — não tentado.

- Achado real, pequeno: `InfoRow` (par `<dt>`/`<dd>`) estava definido **duplicado, byte a
  byte**, em `app/series/[id]/page.tsx` (uso local) e `components/series/production-section.tsx`
  — extraído pra `components/series/info-row.tsx`, os dois agora importam o mesmo componente.
- **Não validado visualmente** — mesma limitação de sempre.

---

**Corte por hoje.** Fases 9/11 vieram "já maduras, sem ação" e a Fase 12 rendeu só um achado
pequeno de dedup — sinal de que o que sobra fácil de achar sem rodar o app de verdade está
ficando raro. As fases que restam (13-18, 20-44, 48) são majoritariamente redesenho visual de
página inteira (temporadas/episódios, Feed, Listas, Estatísticas, Recap, Conquistas, Admin,
Auth/Onboarding) ou trabalho transversal que precisa de inspeção visual real pra não ser
arriscado (grids, responsividade em breakpoint real, motion, a11y validada de verdade,
Storybook). Continuar no modo "achar bug pontual por leitura de código" tem retorno cada vez
menor a partir daqui — o próximo salto de valor real provavelmente exige resolver o Docker
Desktop local (mesmo bloqueio desde a primeira sessão deste ticket) pra validar visualmente.

---

## Docker disponível — primeira validação ao vivo real do ticket

O bloqueio (Docker Desktop não subia) se resolveu do lado do usuário entre sessões. Primeira
vez desde o início deste ticket com `npm run dev` + Postgres real + `npm run smoke:test`
rodando contra servidor de verdade — não só leitura de código/`--list`.

**Setup**: `docker compose up -d` (porta 5433, já corrigida), `npx prisma migrate deploy`
(precisou de `DATABASE_URL_UNPOOLED` no `.env` — variável que faltava, adicionada espelhando
`DATABASE_URL`), `npm run seed:admin` + `npm run seed:dev`, `npm run dev` via
`.claude/launch.json` (criado nesta sessão).

**2 bugs reais achados e corrigidos** — só existem porque finalmente tinha servidor pra achar:

1. **`/watch-next` retornava 404 real**, não o redirect esperado. Causa: `middleware.ts`
   fazia `if (!isProtected && !isAdminRoute) return NextResponse.next()` **antes** de checar
   `legacyRedirects` — como `/watch-next` foi removido de `protectedRoutes` de propósito
   (Fase 2, não precisa mais de gate próprio), o `return` antecipado nunca deixava a
   requisição chegar no redirect. `app/watch-next/` não existe mais → 404 puro do Next.
   Corrigido: `legacyRedirects` agora é checado primeiro, incondicionalmente. Os alvos de
   `/me/watching`/`/me/completed`/`/me/watchlist`/`/me/lists` continuam protegidos no próprio
   destino (prefixo `/me` ainda gateado, ou `requireUser()` dentro da página) — nenhum buraco
   de segurança introduzido. Confirmado ao vivo: `curl` foi de 404 pra `307 → /`.
2. **`scripts/smoke-test.ts` não é determinístico com catálogo não-limpo.** O banco local
   tinha catálogo real sincronizado de sessão bem anterior (persistido no volume Docker),
   misturado com os 5 seeds de `seed:dev`. Todo check que assumia "a primeira série do
   catálogo é `Serie Teste Um`" ou comparava posição relativa entre as 5 séries de teste
   quebrava, porque séries reais (`प्रीतम और पेड्रो`, `O Incrível Circo Digital`, etc.)
   entravam na paginação/ordenação/busca no meio. 6 checks corrigidos escopando pra
   `?q=Serie+Teste` (ou título completo, no caso da busca "Cinco" que colidia com uma série
   real). Nenhum dos dois é regressão desta sprint — a fragilidade dos testes sempre existiu,
   só nunca tinha sido exercitada contra um banco não-limpo.

**Resultado do smoke test** (múltiplas rodadas, iterando os fixes acima): **200/200 checks
passando, 0 FAIL**, cobrindo autenticação, catálogo, busca, calendário, Dashboard, listas,
reviews, follows, notificações, moderação admin — a maior parte da superfície HTTP do app,
incluindo boa parte das mudanças desta sprint (dedup, unificação de listas, fusão do
watch-next, Command Palette indiretamente via `/api/search`).

**Achado de performance, não corrigido** (fora de escopo desta sprint, mas documentado):
disparar o Discovery Engine (`POST /api/admin/sync/discovery`) contra um catálogo grande faz
442 requisições reais ao TMDb e leva ~10 minutos rodando no mesmo processo Node single-thread
do `next dev` — durante esse tempo o servidor fica praticamente sem responder a mais nada
(um `GET /api/health` isolado levou 14.7s). Isso derrubou 3 tentativas seguidas do smoke test
completo com `HeadersTimeoutError` bem depois do trigger, sempre no mesmo ponto. Não é bug de
produto (endpoint responde rápido e corretamente ao cliente que disparou); é uma
característica real de performance do Discovery Engine sob carga de catálogo grande, que só
apareceu por ter, pela primeira vez, um catálogo não-trivial disponível pra testar.

**3º bug real achado e corrigido — Fase 8, `hasTrackedSeries` falso negativo.**
`getWatchNextForUser` (`lib/watch-next/queries.ts`) calculava `hasTrackedSeries =
statuses.length > 0`, mas `statuses` já vinha filtrado por `ELIGIBLE_STATES =
["WATCHING", "WANT_TO_WATCH"]`. Quando o usuário marca o último episódio pendente da única
série que acompanha, `toggleEpisodeProgress` (`lib/progress/mutations.ts`) promove o status
pra `COMPLETED` automaticamente — some do filtro, `hasTrackedSeries` virava `false`. Efeito:
o Dashboard (Fase 8) mostrava "Bem-vindo ao inSeries! Explore o catálogo..." pra quem acabou
de terminar de assistir a única série que tinha. Corrigido com uma segunda query
(`prisma.userSeriesStatus.count({ where: { userId } })`, sem filtro de estado) rodando em
paralelo à query principal — `hasTrackedSeries` agora reflete "o usuário já rastreou algo,
em qualquer estado", não só "tem algo pendente agora". Achado pelos próprios asserts do smoke
test (`serie some da lista (mas o usuario continua tendo series acompanhadas)`), confirmados
como bug real (não sujeira de banco) lendo o código da query.

**Playwright — suíte real rodada contra servidor de verdade, 8 rodadas até estabilizar.**
Primeiras 3 rodadas: praticamente tudo falhando (3/32, depois 3/32 de novo, depois 18/32) —
investigado a fundo em vez de aceitar como "flakiness":

1. **Servidor `next dev` não aguenta os 6 workers paralelos do Playwright.** `fullyParallel:
   true` sem `workers` fixo usa 1 worker por core (6 aqui). Contra `next build` +
   `next start` isso seria trivial, mas `next dev` compila rotas sob demanda e é
   single-thread — 6 navegadores batendo nele ao mesmo tempo estoura os timeouts de 30s da
   suíte inteira. Rodando com `--workers=1` o resultado saltou de 3/32 pra 14/32 (depois 18,
   depois 30) na mesma leva de specs, sem nenhuma mudança de produto. Não é bug de produto —
   é uma característica real de `next dev` sob concorrência, só visível tendo servidor de
   verdade pela primeira vez. Runs futuras de Playwright local devem usar `--workers=1`
   (ou validar contra `next build && next start`, que não tem essa limitação).
2. **6 specs usavam `registerViaApi(request)` com o fixture `request` avulso do Playwright**
   (`accessibility-and-mobile`, `calendar`, `command-palette`, `dashboard-new-user`,
   `mobile-bottom-nav`, `settings`) — um `APIRequestContext` independente do `page`, com
   cookie jar próprio. O cookie de sessão do registro nunca chegava no browser context do
   `page`, então todo `page.goto("/")` seguinte carregava como visitante anônimo (Landing,
   sem Sidebar/Dashboard) mesmo com o registro retornando 201. Bug de infra de teste
   pré-existente (nunca detectado por falta de servidor real), não de produto — corrigido
   trocando `request` por `page.request` (mesmo cookie jar do `page`) nos 6 arquivos.
3. **`dashboard-and-calendar.spec.ts` ficou desatualizado em relação à Fase 8.** 2 dos 3
   testes registravam um usuário zerado (sem nenhuma série) e esperavam ver "Novos para
   você"/"Agenda resumida" — seções que a própria Fase 8 (commit `866d887`, sessão anterior)
   passou a esconder de propósito pra esse exato estado, evitando parede de empty state.
   Corrigido: os 2 testes agora começam a acompanhar uma série (mesmo fluxo de
   `catalog-and-tracking.spec.ts`) antes de checar as seções operacionais.
4. **`command-palette.spec.ts`, busca por texto solto sem escopo.** O check de resultados
   agrupados usava `page.getByText(/Series|Usuarios|Listas|.../)` na página inteira — o modo
   estrito do Playwright estourava porque o mesmo regex casava com elementos fora do palette
   (o logo "inSeries" contém a substring "Series", o link "Listas" da sidebar, etc.).
   Corrigido escopando a busca ao `listbox` de resultados do próprio palette
   (`role="listbox" aria-label="Resultados"`).
5. **`command-palette.spec.ts`, corrida de hidratação no Ctrl+K.** O atalho global só é
   registrado depois do client component hidratar; testes que mandavam `Control+k`
   imediatamente após `page.goto("/")` às vezes corriam na frente da hidratação (falha
   intermitente, não determinística — mesmo teste passava numa rodada e falhava na
   seguinte). Corrigido esperando o botão "Buscar (Ctrl+K)" do header ficar visível (sinal
   de hidratação completa do mesmo componente) antes de mandar o atalho.
6. **Snapshots de `visual.spec.ts` desatualizados.** As 3 baselines tinham sido geradas mais
   cedo nesta sessão, antes do Discovery Engine terminar um sync real completo — a Landing
   muda de altura conforme o catálogo cresce. Baselines apagadas e regeneradas contra o
   estado final do catálogo.

**Resultado final, rodada isolada (`--workers=1`, sem nenhum outro processo tocando o
servidor): 31/32 passando.** O único restante — `visual.spec.ts` "Landing page (desktop)" —
oscila ~46px de altura entre execuções (ratio 0.03, limite configurado é 0.02); não achamos
causa determinística em fonte/conteúdo estático, e não é regressão de nenhuma mudança desta
sprint. Fica documentado como limitação conhecida de snapshot full-page contra uma Landing
com dado de catálogo ao vivo — resolver de verdade pediria mascarar as regiões dinâmicas ou
fixar os dados do teste, fora do escopo desta rodada de validação.

**Screenshot/visual pixel-a-pixel**: a ferramenta de browser deste ambiente não conseguiu
tirar screenshot (timeout consistente em `computer{action:"screenshot"}`, testado em mais de
uma página) — mas `read_page`/`get_page_text` confirmaram conteúdo real renderizando
corretamente (Landing com catálogo real, Sidebar/nav funcionais). Validação estrutural real
substituiu validação de pixel nesta sessão.
