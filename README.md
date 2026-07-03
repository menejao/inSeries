# inSeries

Plataforma social focada em series, web-first, mobile-first e preparada para instalacao via PWA.

## Stack

- Next.js 15 + React 19 + TypeScript
- Tailwind CSS
- Prisma + PostgreSQL
- Sessao por cookie assinado com `AUTH_SECRET`
- Hash de senha com `scrypt`
- Integracao TMDb isolada por servico, adapter e normalizadores

## Ambiente local (banco real)

1. Copie `.env.example` para `.env`
2. Ajuste `AUTH_SECRET`, `NEXT_PUBLIC_APP_URL` e, se quiser catalogo real, `TMDB_API_KEY` ou `TMDB_ACCESS_TOKEN`. `DATABASE_URL` ja vem configurado para o Postgres do Docker Compose abaixo
3. Suba o Postgres local: `docker compose up -d`
4. Instale dependencias: `npm install`
5. Aplique as migrations: `npx prisma migrate dev`
6. Gere o Prisma Client: `npx prisma generate`
7. Popule o catalogo minimo de teste (nao depende de TMDb): `npm run seed:dev`
8. Rode o projeto: `npm run dev`

O Postgres sobe com `user: inseries`, `password: inseries`, `database: inseries` (porta `5432`), conforme `docker-compose.yml`. Nunca commite um `.env` real com segredo sensivel; apenas `.env.example` fica no repositorio.

## Autenticacao

- Cadastro: `POST /api/auth/register`
- Login: `POST /api/auth/login`
- Logout: `POST /api/auth/logout`
- Sessao persiste via cookie `inseries_session`
- Rotas protegidas: `/me`, `/me/watching`, `/me/completed`, `/me/watchlist`, `/me/lists`, `/settings`
- Senha nunca fica em texto puro; hash usa `scrypt`

## Progresso

- Status salvo em `UserSeriesStatus`
- Episodios assistidos salvos em `UserEpisodeProgress`
- Progresso calcula total, assistidos, porcentagem e proximo episodio
- Usuario nao autenticado continua vendo catalogo publico, mas recebe CTA para login ao salvar progresso

## Catalogo

- `npm run seed:dev`: cria localmente 5 series cobrindo os 5 status do catalogo (`RETURNING`, `ENDED`, `CANCELED`, `IN_PRODUCTION`, `PILOT`), anos, generos, popularidade e nota (`voteAverage`) diferentes entre si, sem depender de chave do TMDb; a "Serie Teste Um" ganha ainda uma temporada com episodios de hoje/esta semana/futuro e uma temporada futura sem episodios, para exercitar calendario e filtros de descoberta juntos
- `npm run seed:catalog` (alias `npm run catalog:seed`): importa series populares do TMDb para o banco (incluindo `voteAverage`/`voteCount` reais); e ignorado automaticamente se `TMDB_API_KEY`/`TMDB_ACCESS_TOKEN` nao estiverem configurados ou se o banco estiver indisponivel
- `POST /api/catalog/import`: prepara importacao sob demanda via `tmdbId`
- `/series`: descoberta e busca real do catalogo (ver secao Descoberta e busca abaixo); usa fallback mock apenas quando o banco estiver indisponivel
- `/series/[id]`: mostra serie, temporadas, episodios, progresso do usuario autenticado e reviews da comunidade

## Sincronizacao do catalogo (TMDb)

O catalogo cresce e se mantem atualizado via sincronizacao controlada com o TMDb, isolada em `lib/catalog/sync.ts`. Nenhuma pagina ou rota chama o TMDb diretamente: tudo passa por essa camada, que registra cada execucao e nunca toca dados criados por usuarios.

### Variaveis de ambiente

- `TMDB_API_KEY` ou `TMDB_ACCESS_TOKEN` (pelo menos uma): credenciais do TMDb. Sem nenhuma delas, todo sync (script ou seed de catalogo) aborta com mensagem clara e sem derrubar o restante da aplicacao
- `TMDB_BASE_URL`: base da API (padrao `https://api.themoviedb.org/3`)
- `TMDB_LANGUAGE`: idioma preferido (padrao `pt-BR`, com fallback automatico para `en-US` quando a TMDb nao tem tradução)

### Diferenca entre seed dev, seed catalog e sync

- `npm run seed:dev`: dados **fixos locais**, sem TMDb, para desenvolvimento e testes (calendario, descoberta, progresso)
- `npm run seed:catalog`: importacao **unica** de series populares do TMDb (primeira pagina), pensada para popular o catalogo uma vez
- `npm run sync:popular` / `npm run sync:series`: sincronizacao **rastreavel e repetivel** — cada execucao vira uma linha em `CatalogSyncRun`, idempotente, pensada para rodar periodicamente (manual ou, no futuro, agendada)

### Rodando a sincronizacao

- `npm run sync:popular [paginas]`: descobre e importa/atualiza series populares do TMDb (1 pagina por padrao, ate 5); cada serie fica isolada — uma falha em uma serie vira um erro reportado, nao aborta as demais
- `npm run sync:series`: refaz o fetch de detalhes/temporadas/episodios de todas as series ja catalogadas (via `ExternalSourceMapping`), sem redescobrir a lista de populares
- Sem `TMDB_API_KEY`/`TMDB_ACCESS_TOKEN`, ambos abortam com mensagem clara, saem com codigo de erro e ainda assim registram um `CatalogSyncRun` com status `FAILED` (auditavel mesmo quando mal configurado)
- Ao final, o terminal mostra um resumo: status (`SUCCESS`/`PARTIAL`/`FAILED`), duracao, quantidade importada/atualizada de series/temporadas/episodios, principais erros e o id do `CatalogSyncRun`
- Nenhum segredo (API key/token) e logado em nenhum momento, inclusive em erros de rede

### Modelo `CatalogSyncRun`

Registra toda execucao de sync: `source`, `type` (`POPULAR_SERIES`, `SERIES_DETAILS`, `SERIES_SEASONS`, `SERIES_EPISODES`, `FULL_REFRESH`), `status` (`RUNNING`, `SUCCESS`, `FAILED`, `PARTIAL`), `startedAt`/`finishedAt`, contadores de importado/atualizado por serie/temporada/episodio, `errorMessage` e `metadata` (lista de erros por serie, quando houver).

### Idempotencia

- Series sao casadas pelo id externo do TMDb (`ExternalSourceMapping`), nao pelo slug: se o titulo mudar no TMDb (e o slug junto), a sincronizacao **atualiza** a serie existente em vez de criar uma duplicata
- Temporadas e episodios tem duas chaves unicas cada (`seriesId+number` / `seasonId+number` e `externalSource+externalId`); o upsert verifica existencia explicitamente antes de criar/atualizar, evitando a violacao de unicidade que uma chamada ingenua de `upsert()` do Prisma causaria ao re-sincronizar a mesma temporada/episodio duas vezes
- Rodar `sync:popular` ou `sync:series` varias vezes seguidas nunca duplica series, temporadas ou episodios — apenas atualiza metadados quando mudam
- O sync so escreve em `Series`, `Season`, `Episode` e `ExternalSourceMapping`; nunca cria, atualiza ou apaga `UserSeriesStatus`, `UserEpisodeProgress`, `Review`, `List`, `ListItem` ou `Activity` — progresso, reviews, listas e atividades do usuario sao sempre preservados
- Erros em uma serie especifica (404, temporada sem episodios, imagem ausente, série sem data) ficam isolados: a execucao continua para as demais e o run final fica `PARTIAL` em vez de `FAILED`

### Tratamento de erros

`lib/tmdb/service.ts` trata timeout (10s, via `AbortController`), 401 (credenciais invalidas), 404 (recurso inexistente), 429 (rate limit) e falhas de rede genericas, sempre com mensagens seguras (sem vazar a URL com a API key). `lib/catalog/sync.ts` isola cada serie individualmente: uma falha vira uma entrada em `errors` no resumo, sem interromper as demais.

### Impacto no calendario e na busca

Nenhuma fonte paralela: `/calendar`, `/api/search` e `/series` sempre leem `Series`/`Season`/`Episode` do banco. Como o sync escreve nessas mesmas tabelas (mesmo caminho de upsert usado pelo seed de catalogo e pela importacao manual via `/api/catalog/import`), qualquer serie/temporada/episodio sincronizado fica automaticamente disponivel para descoberta, filtros e calendario assim que a sincronizacao termina — sem cache ou indice paralelo para manter sincronizado.

### Jobs futuros (nao implementados nesta sprint)

`lib/jobs/registry.ts` (`futureCatalogSyncJobs`) documenta a agenda prevista para um scheduler futuro (cron, Vercel Cron ou fila), sem cron real implementado:

- `daily-popular-series-sync` (diario): `syncPopularSeries({ pages: 2 })`
- `daily-upcoming-episodes-sync` (diario): atualiza detalhes das series que usuarios estao assistindo/querem assistir
- `weekly-full-metadata-refresh` (semanal): `syncFullRefresh({ pages: 3 })`, cobrindo populares + todo o catalogo existente

## Descoberta e busca

Camada isolada em `lib/discovery/search.ts`, reutilizavel por catalogo, calendario, listas, perfil e uma futura busca dedicada — nenhuma logica de filtro/ordenacao/paginacao fica na pagina.

### Filtros e ordenacao de `/series`

Query params, combinaveis livremente:

- `q`: busca case-insensitive em titulo, titulo original e sinopse
- `genre`: filtra por genero exato (valores vem do banco, nunca hardcoded)
- `status`: filtra por status do catalogo (`RETURNING`, `ENDED`, `CANCELED`, `IN_PRODUCTION`, `PILOT`)
- `year`: filtra por ano de estreia (`firstAirYear`)
- `sort`: `popular` (padrao, por `popularityScore`), `latest` (por ano de estreia), `title` (alfabetica) ou `rating` (por `voteAverage`, series sem nota ficam sempre por ultimo)
- `page`: paginacao (12 series por pagina, limite maximo de 50)

Exemplo: `/series?q=dark&genre=Drama&year=2024&sort=popular&page=1`

Metadados de filtro (`getCatalogFilterMetadata`) — generos, anos e status disponiveis, e total de series — vem sempre do banco (`DISTINCT` nas colunas reais), nunca de uma lista fixa no codigo.

### `POST/GET /api/search`

Endpoint dedicado para busca global, preparado para reuso por outras telas:

- `q`: termo de busca
- `type`: `series` (padrao), `users`, `lists`, `reviews` ou `all`
- `limit`: maximo de resultados por tipo (ate 50)

Nesta sprint, `type=series` e totalmente funcional (mesma query layer de `/series`). `type=users`, `type=lists` e `type=reviews` ja tem implementacao real e simples (busca por username/nome, titulo de lista publica e corpo de review publica, respectivamente) — arquitetura preparada para uma busca global completa, sem UI dedicada ainda. Privacidade e respeitada: apenas listas e reviews com `visibility: PUBLIC` sao retornadas; usuarios expoem apenas campos ja publicos (username, nome, avatar).

### `SearchProvider` (preparacao para motor de busca dedicado)

`lib/discovery/provider.ts` define o contrato `SearchProvider` e a implementacao atual `DatabaseSearchProvider` (consulta Postgres direto via Prisma). Todo call site usa `searchProvider` (nunca Prisma diretamente), entao trocar para `MeilisearchProvider` ou `ElasticsearchProvider` no futuro (nao implementados nesta sprint) exige apenas satisfazer o mesmo contrato e trocar a instancia exportada — nenhuma pagina ou API precisa mudar.

### Performance basica

- Paginacao obrigatoria com limite maximo de 50 itens por pagina
- Indices Prisma em `status`, `firstAirYear`, `popularityScore`, `voteAverage` e `title` (colunas usadas em filtro/ordenacao)
- Busca por texto sempre case-insensitive (`mode: "insensitive"`)
- Uma unica query de contagem (`count`) + uma de listagem por requisicao, sem N+1: a listagem de `/series` nao carrega temporadas/episodios (desnecessarios para o card), diferente da pagina de detalhe da serie

## Fundacao social

O inSeries evolui de catalogo pessoal para uma camada social: perfil publico, seguir usuarios, listas e reviews, com privacidade aplicada em todas as camadas.

### Perfil publico e edicao

- `/profile/[username]`: perfil publico com avatar, nome, username, bio, data de entrada, contagem de seguidores/seguindo, series assistindo/concluidas (se publicas), listas publicas e reviews publicas
- Perfil privado (`isProfilePrivate`) oculta series, listas e reviews para visitantes e mostra apenas informacoes basicas; o proprio dono sempre ve seus dados completos, mesmo com o perfil marcado como privado
- `/settings`: edicao de nome, username, bio, avatarUrl e todos os toggles de privacidade
- `PATCH /api/profile`: atualiza o proprio perfil; valida username unico, formato amigavel para URL (`^[a-z0-9](?:[a-z0-9._]{1,22}[a-z0-9])?$`) e limites de caracteres

### Seguir usuarios

- `POST /api/users/[username]/follow`: segue um usuario (idempotente, 400 ao tentar seguir a si mesmo, 404 se o usuario nao existe)
- `DELETE /api/users/[username]/follow`: deixa de seguir
- Contadores de seguidores/seguindo no perfil sao sempre calculados a partir do banco

### Privacidade

Campos em `User`, todos aplicados no perfil publico, nas listas e nas reviews exibidas a terceiros:

- `isProfilePrivate`: perfil publico ou privado
- `showWatchingSeries`: exibe series em andamento
- `showWatchedSeries`: exibe series concluidas
- `showLists`: exibe listas publicas no perfil
- `showReviews`: exibe reviews publicas no perfil
- `showActivity`: mostra/oculta a atividade do usuario no feed e no perfil (ver secao Feed de atividades)

Nenhum endpoint publico retorna listas, reviews ou series privadas de outro usuario; a checagem de dono (`userId` da sessao) e feita em toda escrita.

### Listas

- `/lists`: descoberta de listas publicas recentes (titulo, descricao, autor, quantidade de series, data)
- `/lists/[id]`: detalhe da lista; dono ve formulario de edicao, exclusao e gerenciamento de itens (adicionar, remover, subir/descer); visitantes veem apenas listas publicas (lista privada de outro usuario retorna 404)
- `/me/lists`: area pessoal para criar e listar as proprias listas
- `POST /api/lists`, `PATCH /api/lists/[id]`, `DELETE /api/lists/[id]`: CRUD restrito ao dono (403 para quem nao e dono)
- `POST /api/lists/[id]/items`, `DELETE /api/lists/[id]/items/[itemId]`, `PATCH /api/lists/[id]/items/[itemId]` (`{ direction: "up" | "down" }`): gerenciamento e reordenacao simples de itens, restrito ao dono

### Reviews

- Na pagina da serie, usuario autenticado escreve review com nota (1-5) e visibilidade publica/privada; reenviar atualiza a mesma review (upsert por usuario+serie)
- `POST /api/series/[id]/reviews`: cria ou edita a propria review
- `DELETE /api/series/[id]/reviews`: apaga a propria review
- Reviews publicas aparecem na pagina da serie e no perfil do autor; review privada so aparece para o proprio autor
- Review de episodio nao foi implementada nesta sprint

## Calendario

`/calendar` centraliza o que importa para cada usuario: episodios lancados, futuros e temporadas anunciadas das series que ele acompanha, usando exclusivamente datas ja persistidas no banco (originadas do TMDb via `Episode.airedAt`).

- Usuario autenticado ve **Meu calendario** por padrao; usuario nao autenticado recebe CTA para login (nao ha redirecionamento por middleware, a propria pagina exibe o convite)
- Calendario pessoal considera apenas series com status `WATCHING` ou `WANT_TO_WATCH`; series pausadas, abandonadas ou concluidas nao aparecem
- Secoes: **Hoje**, **Esta Semana**, **Proximos Lancamentos**, **Temporadas Futuras** (temporadas cadastradas sem episodios ainda detalhados), **Atrasados** (ja lancados e nao assistidos) e **Assistidos Recentemente** (ultimos 14 dias); cada secao tem empty state proprio
- Cada card mostra poster da serie, imagem do episodio, titulo da serie, codigo `TxxExx`, titulo do episodio, data, status do usuario, botao "Marcar assistido" (reaproveita o mesmo componente de progresso da pagina da serie) e link para abrir a serie
- Aba **Todos os lancamentos**: navegacao por Hoje/Semana/Mes e filtros (genero, idioma, apenas minhas series, apenas ineditos, apenas nao assistidos) consultando somente o banco, nunca o TMDb diretamente na pagina; filtros de plataforma e pais ficam com a estrutura pronta na UI, aguardando os campos correspondentes no catalogo
- Na pagina da serie, secao **Proximo episodio** mostra numero, titulo, data e dias restantes do proximo episodio com data futura conhecida, ou a mensagem "Serie sem episodios futuros." quando nao ha previsao
- No dashboard `/me`, secao **Proximos episodios** lista os 5 proximos episodios nao assistidos das series acompanhadas, com link para o calendario completo
- `lib/jobs/registry.ts` (`futureCalendarJobs`) prepara a arquitetura para sincronizacao futura (novos episodios, mudanca de datas, temporadas anunciadas) sem implementar um cron real nesta sprint

## Feed de atividades

`/feed` transforma acoes reais dos usuarios em descoberta social: o que as pessoas que voce segue estao assistindo, avaliando e listando, na mesma linha do Letterboxd mas com foco exclusivo em series.

### Tipos de atividade (`ActivityType`)

- `EPISODE_WATCHED`: gerada ao marcar um episodio como assistido (nao ao desmarcar)
- `SERIES_STATUS_CHANGED`: gerada quando o usuario troca explicitamente o status de uma serie (`/api/series/[id]/status`) para um valor diferente do anterior
- `SERIES_COMPLETED`: gerada quando uma serie passa a ter status `COMPLETED`, seja por troca explicita de status ou como efeito de marcar o ultimo episodio pendente
- `REVIEW_CREATED`: gerada apenas na criacao da primeira review publica de um usuario para uma serie; editar a review depois nao gera nova atividade
- `LIST_CREATED`: gerada apenas quando a lista criada e publica
- `USER_FOLLOWED`: gerada ao seguir outro usuario (idempotente; nao duplica em re-follow)

Cada `Activity` referencia opcionalmente `seriesId`, `episodeId`, `reviewId`, `listId` e `targetUserId`, com `onDelete: Cascade`: se a serie, episodio, review, lista ou usuario relacionado for removido, a atividade correspondente desaparece junto (sem registros orfaos).

Nao geram atividade: desmarcar um episodio, criar review ou lista privada, reenviar o mesmo status sem mudanca (correcao silenciosa).

### Privacidade do feed

Toda leitura de atividades (feed pessoal, feed global, `/me`, perfil publico) respeita, em tempo de leitura (nao apenas na criacao):

- `isProfilePrivate`: perfil privado nunca aparece para terceiros, nem atividades antigas
- `showActivity`: se desativado, nenhuma atividade do usuario aparece para terceiros
- `showWatchedSeries` / `showWatchingSeries`: controla `EPISODE_WATCHED`/`SERIES_COMPLETED` e `SERIES_STATUS_CHANGED` respectivamente
- `showLists` e `showReviews`: controlam `LIST_CREATED` e `REVIEW_CREATED`
- Alterar a visibilidade de uma lista ou review existente sincroniza a visibilidade da atividade associada
- O proprio usuario sempre ve sua atividade completa em `/me`, independente das proprias configuracoes de privacidade

### Rotas e componentes

- `/feed`: aba **Para voce** (atividades proprias + de quem voce segue) e aba **Global** (atividades publicas recentes de toda a comunidade); usuario nao autenticado ve CTA para login na aba pessoal, mas a aba global continua publica
- `/me`: secao **Atividade recente** com as ultimas 5 atividades e link para o feed completo
- `/profile/[username]`: secao **Atividade** com atividades publicas daquele usuario, respeitando toda a privacidade acima
- `components/feed/activity-card.tsx`: card reutilizavel (avatar, nome/username, acao, serie/episodio/review/lista relacionados, data relativa, links)
- Navegacao: **Feed** no menu desktop; no mobile, como a bottom navigation ja estava com 6 itens, o Feed foi colocado em um menu secundario no cabecalho (visivel apenas em telas pequenas) para nao sobrecarregar a barra inferior

## Notificacoes

Fundacao de notificacoes internas persistidas no banco. Nesta sprint **nao** ha push notification, e-mail, WebSocket/realtime ou digest — apenas infraestrutura interna confiavel, pronta para esses canais evoluirem depois.

### Modelo (`Notification`)

Campos: `id`, `userId` (destinatario), `type`, `title`, `body`, `href`, `readAt`, `actorUserId` (opcional, quem gerou o evento), `seriesId`/`episodeId`/`reviewId`/`listId` (opcionais, para linkar o conteudo relacionado), `metadata`, `createdAt`. Indices em `[userId, createdAt]`, `[userId, readAt]` e `[createdAt]`.

Tipos (`NotificationType`): `NEW_EPISODE_AVAILABLE`, `FOLLOWED_YOU`, `REVIEW_FROM_FOLLOWING`, `LIST_FROM_FOLLOWING`, `SERIES_COMPLETED`, `ADMIN_NOTICE`.

### Servico isolado (`lib/notifications/service.ts`)

Nenhuma pagina cria notificacao diretamente — tudo passa por este servico: `createNotification`, `notificationExists` (dedup), `listNotifications`, `countUnreadNotifications`, `markNotificationRead`, `markAllNotificationsRead`, e `createAdminNotice` (fundacao do `ADMIN_NOTICE`, sem UI de broadcast ainda).

A logica de cada evento (quem notificar, com qual privacidade) fica em `lib/notifications/events.ts`, chamada pelos servicos de dominio existentes (nunca por componentes React):

- **`FOLLOWED_YOU`**: `lib/social/follow.ts` chama `notifyUserFollowed` apenas quando um novo `Follow` e criado (nunca em follow duplicado/idempotente)
- **`REVIEW_FROM_FOLLOWING`**: `lib/social/reviews.ts` chama `notifyFollowersOfPublicReview` apenas na criacao de uma review nova com `visibility: PUBLIC`; nunca em edicao. So notifica se o autor **nao** estiver com perfil privado e tiver `showActivity`/`showReviews` habilitados
- **`LIST_FROM_FOLLOWING`**: mesmo contrato, em `lib/social/lists.ts` (`notifyFollowersOfPublicList`), gated por `showLists`
- **`SERIES_COMPLETED`**: `lib/progress/mutations.ts` chama `notifySeriesCompleted` para o proprio usuario, nos dois caminhos que levam a conclusao (mudar status manualmente para `COMPLETED` ou completar via ultimo episodio assistido), sempre que o estado anterior nao era `COMPLETED`
- **`NEW_EPISODE_AVAILABLE`**: preparado em `lib/notifications/episode-availability.ts` (ver script abaixo), nao e disparado em tempo real

Nenhum evento social notifica com base em conteudo oculto: perfil privado, `showActivity`, `showReviews`, `showLists` e visibilidade `PRIVATE`/`FOLLOWERS` sempre bloqueiam a notificacao correspondente.

### Rotas e indicador

- `/notifications`: lista as notificacoes do usuario autenticado (mais recentes primeiro), com badge de nao lida, botao **Marcar como lida** por item e **Marcar todas como lidas**; usuario nao autenticado e redirecionado para `/login` (protegido em `middleware.ts`)
- Indicador no menu (`components/notifications/notifications-nav-link.tsx`): mostra "Notificacoes" ou "Notificacoes (N)" com a contagem de nao lidas; presente no menu desktop e no menu secundario mobile do cabecalho; atualizado a cada carregamento de pagina (nao e realtime)

### Endpoints

- `GET /api/notifications`: lista notificacoes do usuario autenticado + `unreadCount`
- `POST /api/notifications/[id]/read`: marca uma notificacao como lida; retorna 403 se o id pertencer a outro usuario, 404 se nao existir
- `POST /api/notifications/read-all`: marca todas as notificacoes do usuario autenticado como lidas

Todos exigem sessao valida (401 sem sessao) e validam que o usuario so altera as proprias notificacoes.

### Script de episodios disponiveis

```
npm run notifications:episodes
```

Executa `generateNewEpisodeAvailableNotifications()`: para cada `UserSeriesStatus` em `WATCHING` ou `WANT_TO_WATCH`, busca episodios da serie com `airedAt` no passado, ignora episodios ja assistidos pelo usuario e ignora quem ja foi notificado daquele episodio (idempotente — rodar de novo nao duplica). Pensado para rodar manualmente ou, futuramente, via cron; nao ha agendamento automatico nesta sprint.

### Limitacoes atuais e proximos passos

- Sem push notification, e-mail, WebSocket/realtime, digest semanal ou app nativo
- Sem painel administrativo completo de broadcast (`createAdminNotice` existe como funcao, sem UI dedicada)
- Sem preferencias avancadas de notificacao por usuario (ainda usa os flags de privacidade existentes)
- Proximos passos previstos: canal de push, envio de e-mail, notificacao em tempo real (WebSocket/SSE), digest semanal, lembretes de episodio agendados, e uma tela administrativa de broadcast sobre `createAdminNotice`

## Workspace administrativo

Area interna em `/admin` para gestao do catalogo, sincronizacoes, saude do sistema e moderacao inicial, sem afetar a experiencia do usuario final.

### RBAC (controle de acesso por papel)

- `User.role`: `USER` (padrao) | `MODERATOR` | `ADMIN`
- Permissoes (`lib/admin/rbac.ts`): `admin.read`, `admin.catalog`, `admin.sync`, `admin.users`, `admin.reviews`, `admin.lists`, `admin.system`
  - `USER`: nenhuma permissao administrativa
  - `MODERATOR`: `admin.read`, `admin.reviews`, `admin.lists`
  - `ADMIN`: todas as permissoes
- **Dupla camada de protecao, nunca so a UI**:
  1. `middleware.ts`: bloqueio rapido em `/admin/:path*` usando o papel (`role`) embutido no cookie de sessao assinado (sem round-trip ao banco, compativel com edge runtime); redireciona convidados para `/login` e usuarios sem permissao para `/`
  2. Toda pagina/rota `/admin/*` chama `requireAdminUser()`/`getAdminApiUser()` (`lib/admin/rbac.ts`), que **revalida o papel diretamente no banco** a cada requisicao — o token de sessao nunca e a unica fonte de verdade
- `role` e incluido no token de sessao no cadastro e no login; login tambem atualiza `User.lastLoginAt`

### Rotas do workspace

- `/admin`: dashboard com indicadores reais (usuarios, series, temporadas, episodios, reviews, listas, follows, atividades) e ultima sincronizacao (status/duracao)
- `/admin/catalog` e `/admin/catalog/[id]`: busca e detalhe somente leitura do catalogo interno (ids externos, `ExternalSourceMapping`, datas, status, popularidade, nota TMDb) — sem edicao destrutiva nesta sprint
- `/admin/sync`: historico de `CatalogSyncRun` (data, duracao, status, origem, tipo, importados/atualizados, erros) e botoes para disparar manualmente "Sincronizar populares" e "Sincronizar series existentes", cada um com confirmacao antes de iniciar; nunca permite duas sincronizacoes do mesmo tipo rodando em paralelo (retorna a execucao em andamento em vez de duplicar)
- `/admin/users`: listagem somente leitura (nome, usuario, email, papel, data de cadastro, ultimo acesso, contagem de reviews/listas/seguidores/seguindo) — sem alteracao de senha ou progresso
- `/admin/reviews`: lista todas as reviews (autor, serie, nota, data, visibilidade) com acoes de **ocultar/restaurar** (nunca exclusao permanente)
- `/admin/lists`: lista todas as listas (autor, titulo, quantidade de series, visibilidade, data) com acoes de **ocultar/restaurar** (nunca exclusao permanente)
- `/admin/system`: versao da aplicacao, ambiente, versao do Prisma, alvo do banco (host/porta/nome, sem credenciais), quantidade de migrations aplicadas, status do banco e versao do Node — nunca expõe segredos/API keys
- `/admin/logs`: consulta ao `AdminAuditLog`

### Moderacao (ocultar/restaurar)

- Campo `hiddenByAdminAt` em `Review` e `List`, **independente** do campo `visibility` controlado pelo proprio usuario — moderacao do admin nunca e desfeita silenciosamente por uma acao do usuario
- Toda leitura publica (pagina da serie, perfil, `/lists`, busca) passa a exigir `hiddenByAdminAt: null` alem de `visibility: PUBLIC`
- Ocultar/restaurar tambem sincroniza a visibilidade da `Activity` associada (`lib/social/activity.ts`), para que o item some/volte tambem do feed
- Implementado em `lib/admin/moderation.ts`: `hideReview`, `restoreReview`, `hideList`, `restoreList`

### Auditoria (`AdminAuditLog`)

- Toda acao administrativa relevante grava um registro: `adminUserId`, `action`, `entity`, `entityId`, `metadata`, `result`, `createdAt`
- Acoes registradas nesta sprint: `START_SYNC`, `HIDE_REVIEW`, `RESTORE_REVIEW`, `HIDE_LIST`, `RESTORE_LIST`
- Gravado por `lib/admin/audit.ts` (`recordAdminAudit`), consultado em `/admin/logs`

### Seed do admin de desenvolvimento

```
npm run seed:admin
```

Cria/atualiza um usuario fixo `admin@inseries.dev` / senha `admin12345` com `role: ADMIN`, usado tambem pelo smoke test.

## Observabilidade e configuracao

Fundacao operacional do inSeries: configuracao centralizada, feature flags, health checks, logs estruturados, request id, metricas basicas, tratamento de erros e rate limit preparado. Nao adiciona funcionalidade nova para o usuario final — prepara a plataforma para operacao continua e futuras integracoes (Prometheus/OpenTelemetry, Sentry, etc.), sem implementa-las ainda.

### Configuracao centralizada (`lib/config`)

- `lib/config/index.ts` e o unico ponto de leitura de `process.env` da aplicacao (as excecoes documentadas em `lib/auth/session.ts`/`lib/db/prisma.ts` sao sobre o proprio `config`, nunca sobre `process.env` bruto)
- Agrupa: `app` (nome, versao — lida de `package.json`, ambiente), `urls`, `auth` (segredo, TTL/nome do cookie de sessao), `database`, `tmdb`, `pagination`, `uploads` (preparado, sem feature de upload ainda), `notifications`, `pwa`, `rateLimit`, `logging` e `featureFlags`
- Substituiu o antigo `lib/env.ts`; as funcoes `getTmdbCredentials`/`getTmdbBaseUrl`/`getTmdbLanguage` continuam existindo (agora em `lib/config`) para nao quebrar `lib/tmdb/service.ts` e `lib/catalog/sync.ts`
- `getPublicConfig()` retorna um subconjunto seguro (nunca inclui `auth.secret`, `database.url` ou chaves do TMDb) usado pelo `/admin/system`
- Valores de ambiente vazios (`TMDB_API_KEY=""`) sao tratados como "nao definido", nunca como erro de validacao — um unico env var vazio nao derruba a configuracao inteira

### Feature flags (`lib/config/flags.ts`)

- Flags: `recommendations`, `tvtimeImport`, `notifications`, `adminWorkspace`, `calendar`, `reviews`, `lists`, `feed`, `experimentalSearch`
- Hoje sao 100% baseadas em variaveis de ambiente (`FEATURE_*`, ex: `FEATURE_RECOMMENDATIONS=true`); `recommendations`, `tvtimeImport` e `experimentalSearch` vem desligadas por padrao (ainda nao implementadas), as demais vem ligadas (recursos ja existentes)
- `isFeatureEnabled(flag)` e `getAllFeatureFlags()` podem ser chamados em qualquer camada (server component, API route, script)
- Arquitetura preparada para trocar a fonte por `SystemSetting`/banco no futuro: `FeatureFlagSource` e uma interface; a implementacao atual (`ConfigFeatureFlagSource`) e so uma das possiveis

### Health e readiness

- `GET /api/health`: liveness — sempre rapido, nunca toca o banco. Retorna `status`, `version`, `environment`, `timestamp`
- `GET /api/ready`: readiness — valida configuracao minima (`DATABASE_URL` definido) e conectividade real com o banco (`SELECT 1`). Retorna `200` com `status: "ready"` quando tudo esta ok, ou `503` com `status: "not_ready"` e o detalhe de qual `check` falhou
- Ambos compartilham a logica de `lib/health/service.ts`, reaproveitada tambem pelo `/admin/system`

### Logs estruturados (`lib/logger`)

- `logger.debug/info/warn/error(message, context)` grava uma linha JSON por evento: `timestamp`, `level`, `message`, `requestId`, `userId` (quando disponivel), `route`, `metadata`
- Nunca registra senha, token, cookie ou API key: qualquer chave de `metadata` que combine com esse padrao e substituida por `"[redacted]"` recursivamente antes de logar
- Nivel minimo configuravel via `LOG_LEVEL` (padrao `debug` fora de producao, `info` em producao)

### Request ID

- Todo request que passa pelo `middleware.ts` (matcher cobre a aplicacao inteira, exceto assets estaticos) recebe um `x-request-id`: reaproveita o header `x-request-id` se o cliente/proxy ja mandou um, ou gera um `crypto.randomUUID()`
- Propagado para: o header da resposta (visivel em qualquer chamada HTTP), os logs estruturados de cada rota (via `withApiObservability`) e a resposta de erro centralizada

### Metricas basicas (`lib/metrics/service.ts`)

- Contadores em memoria (processo unico, reiniciam a cada deploy/restart — nada e persistido): total de requests, tempo medio de resposta, erros 4xx/5xx, logins, cadastros, syncs iniciados, notificacoes criadas, atividades criadas
- Alimentados automaticamente por `withApiObservability` (todas as rotas `/api/*`) e por pontos de negocio especificos (`recordActivity`, `createNotification`, `createRun` do catalogo)
- Expostos em `GET /api/admin/metrics` (JSON, protegido por `admin.system`) e na pagina `/admin/system` — o endpoint JSON e o ponto de extensao pensado para uma futura integracao com Prometheus/OpenTelemetry

### Tratamento centralizado de erros (`lib/errors`)

- Classes: `ValidationError`, `AuthenticationError`, `AuthorizationError`, `NotFoundError`, `DatabaseError`, `ExternalServiceError` (todas extendem `AppError`, com `code`+`status` HTTP)
- `toErrorResponse(error)` mapeia qualquer excecao (incluindo erros do Prisma e do cliente TMDb) para uma resposta JSON consistente (`{ error, message }`) — nunca inclui stack trace
- Usado como rede de seguranca dentro de `withApiObservability`: se uma rota lancar uma excecao nao tratada, a resposta ao cliente continua consistente em vez de vazar detalhes internos ou derrubar o processo. As respostas de validacao/negocio que cada rota ja retornava explicitamente (`{ error: "invalid_payload" }`, etc.) continuam do jeito que estavam

### Rate limit preparado (`lib/rate-limit`)

- Limitador em memoria (janela fixa) para os buckets `login`, `register`, `search`, `sync` e `admin`
- **Desligado por padrao** (`RATE_LIMIT_ENABLED=true` liga); enquanto desligado, `checkRateLimit` sempre permite — inclusive o smoke test dispara dezenas de logins/cadastros sem risco de ser bloqueado
- Ja integrado nas rotas de login, registro, busca, disparo de sync e moderacao administrativa — falta apenas ligar a flag e (se for para producao multi-instancia) trocar o estado em memoria por um store compartilhado (Redis)

### System Settings (`SystemSetting`)

- Entidade Prisma preparada para configuracao editável pelo admin no futuro: `key` (unico), `value` (JSON), `description`, `public`, `updatedAt`
- Somente leitura/seed nesta sprint — sem UI de edicao ainda. `lib/system-settings/service.ts` expõe `listSystemSettings`, `listPublicSystemSettings`, `getSystemSetting`, `seedInitialSystemSettings`
- `npm run seed:dev` semeia 3 valores de exemplo (`app.maintenance_mode`, `app.announcement`, `catalog.max_popular_sync_pages`), visiveis em `/admin/system`

### `/admin/system` (Fase 11)

Alem das informacoes ja existentes (versao, ambiente, Prisma, banco, migrations, Node), a pagina agora mostra: feature flags (ligada/desligada), status de health e ready (com o detalhe de cada check), metricas basicas e configuracao publica (URL da app, paginacao padrao, TMDb configurado, rate limit ativo) e a tabela de `SystemSetting`. Somente leitura — sem edicao nesta sprint.

### Limitacoes atuais e proximos passos

- Sem Prometheus, Grafana, OpenTelemetry, Sentry, Datadog ou CloudWatch — os pontos de extensao (`lib/metrics/service.ts`, `GET /api/admin/metrics`) foram desenhados para plugar essas integracoes depois
- Metricas e rate limit sao em memoria, por processo — não sobrevivem a restart nem sao compartilhados entre instancias; produção multi-instância precisaria de um store compartilhado (Redis)
- `SystemSetting` ainda nao tem UI de edicao pelo admin
- Rate limit existe mas fica desligado por padrao — ativa-lo em produção é so definir `RATE_LIMIT_ENABLED=true`
- Sem deploy automatico, sem digest/alertas baseados nas metricas

## Smoke test (validacao ponta a ponta)

Com o banco no ar, migrations aplicadas e seed dev rodado, suba o projeto (`npm run dev`) em um terminal e, em outro, rode:

```
npm run smoke:test
```

O script (`scripts/smoke-test.ts`) executa via HTTP contra `http://localhost:3000` (configuravel com `SMOKE_BASE_URL`):

1. cadastro de usuario novo;
2. confirmacao de cookie de sessao;
3. login;
4. `/api/auth/me` autenticado;
5. bloqueio de `/me` sem sessao;
6. leitura do catalogo seedado;
7. descoberta e busca: `/series` sem filtro, `q`, `genre`, `status`, `year`, `sort` (`popular`/`latest`/`title`/`rating`) e `/api/search` (`type=series` e `type=all`, incluindo os arrays preparados de `users`/`lists`/`reviews`);
8. alteracao de status da serie para `WATCHING`;
9. marcar, desmarcar e marcar novamente um episodio, validando recalculo de progresso e proximo episodio;
10. cadastro de um segundo usuario e fundacao social: seguir/deixar de seguir, contadores de seguidores, bloqueio de auto-follow e follow duplicado;
11. listas: criar, editar, adicionar serie, remover serie, apagar, e confirmar que outro usuario nao consegue editar/apagar lista alheia (403);
12. reviews: criar, editar (upsert), apagar, e confirmar que a review de um usuario nao e afetada pela review de outro na mesma serie;
13. privacidade: perfil privado oculta dados para terceiros mas o dono continua vendo tudo;
14. calendario: CTA de login sem sessao, calendario pessoal exibindo episodio de hoje e temporada futura, calendario global filtrado por periodo e por "apenas minhas series", secao "Proximo episodio" na pagina da serie e secao "Proximos episodios" no dashboard `/me`;
15. feed de atividades: geracao de atividade ao seguir usuario, marcar episodio, criar review e criar lista publica; confirmacao de que desmarcar episodio nao gera atividade duplicada; feed pessoal mostrando atividades de quem se segue; feed global mostrando atividades publicas; perfil privado deixando de aparecer no feed global e no feed pessoal de terceiros; `/me` continuando a mostrar a propria atividade mesmo com o perfil privado;
16. logout e confirmacao de que a sessao foi invalidada;
17. notificacoes: seguir gera `FOLLOWED_YOU`; review publica de quem se segue gera `REVIEW_FROM_FOLLOWING` e review privada nao gera notificacao adicional; lista publica de quem se segue gera `LIST_FROM_FOLLOWING` e lista privada nao gera notificacao adicional; concluir uma serie gera `SERIES_COMPLETED` para o proprio usuario; contador de nao lidas, marcar uma como lida e marcar todas como lidas; usuario nao consegue ler/alterar notificacao de outro (403); `/notifications` exige sessao (redireciona convidado); script `notifications:episodes` roda duas vezes seguidas sem duplicar notificacoes;
18. workspace administrativo: `/admin` bloqueado para convidado e para usuario comum, login do admin de desenvolvimento (requer `npm run seed:admin`), acesso ao dashboard/catalogo/sync/usuarios/sistema/reviews/listas, disparo de sync sem TMDb configurado retornando erro amigavel, bloqueio de usuario comum nas rotas de admin (403), ocultar/restaurar review e lista (com o item sumindo/voltando das paginas publicas) e confirmacao de que o `AdminAuditLog` registra as acoes em `/admin/logs`;
19. observabilidade: `/api/health` responde com status/versao/ambiente/timestamp e propaga `x-request-id`; `/api/ready` responde `ready` com banco e configuracao saudaveis (a falha do banco gerando `ready` com `503` foi validada manualmente parando o Postgres, ja que o smoke test nao derruba servicos do sistema); um `x-request-id` recebido por header e reaproveitado em vez de substituido; um payload JSON invalido gera uma resposta consistente (`INTERNAL_ERROR`, sem stack trace); `/api/admin/metrics` bloqueia usuario comum (403) e o contador de requests cresce a cada chamada; `/admin/system` mostra feature flags, health/ready e metricas.

## Comandos

- `npm install`: instala dependencias
- `docker compose up -d`: sobe o Postgres local
- `npx prisma migrate dev`: aplica migrations no banco local
- `npx prisma generate`: gera o Prisma Client
- `npm run seed:dev`: popula catalogo de teste variado (5 series, status/genero/ano/popularidade/nota diferentes) para validar progresso, calendario e descoberta
- `npm run seed:admin`: cria/atualiza o usuario admin de desenvolvimento (`admin@inseries.dev` / `admin12345`, `role: ADMIN`) usado no workspace `/admin` e no smoke test
- `npm run seed:catalog`: executa seed do catalogo real via TMDb (opcional)
- `npm run sync:popular [paginas]`: sincroniza series populares do TMDb (idempotente, registra `CatalogSyncRun`)
- `npm run sync:series`: sincroniza detalhes/temporadas/episodios das series ja catalogadas
- `npm run notifications:episodes`: gera notificacoes `NEW_EPISODE_AVAILABLE` para quem acompanha series com episodios ja lancados (idempotente, nao ha cron real ainda)
- `npm run dev`: sobe ambiente local
- `npm run smoke:test`: roda o smoke test HTTP do fluxo principal
- `npm run typecheck`: valida TypeScript
- `npm run lint`: roda ESLint CLI
- `npm run build`: gera Prisma Client e executa build de producao

## PWA

- Manifest em `app/manifest.ts`
- Service worker base em `public/sw.js`
- Icones placeholder em `public/icons`
- Metadata mobile-first com `themeColor`, `viewportFit` e `display: standalone`
