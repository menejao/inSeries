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

## Design System

Redesign completo de UX/UI do inSeries: identidade visual propria, tema claro/escuro, um Design System consolidado e uma pausa em todas as telas para eliminar inconsistencia visual. **Esta sprint nao mudou nenhuma regra de negocio, API, banco ou fluxo de autenticacao/RBAC** — todo trabalho foi de apresentacao, reaproveitando a infraestrutura ja construida (as mesmas queries, os mesmos endpoints, os mesmos formularios).

### Principios

- **Foco em series, elegancia, velocidade** — inspirado na experiencia (nunca no layout) de Letterboxd, TV Time, Apple TV, Plex, Arc Browser e Linear
- **Nenhuma tela usa estilo fora do Design System** — cores, espacamento, raio e sombra sempre vem dos tokens abaixo, nunca de valores soltos tipo `bg-slate-950/60` ou `text-amber-200`
- **Consistente nos dois temas** — todo componente foi desenhado para funcionar em claro e escuro sem exceçoes

### Tokens (`tailwind.config.ts` + `app/globals.css`)

- Cor: cada token e uma variavel CSS "R G B" (`--c-*`) redefinida em `:root` (escuro, padrao) e `:root[data-theme="light"]`, consumida via `rgb(var(--c-x) / <alpha-value>)` — isso permite usar opacidade (`bg-surface/60`) igual em ambos os temas
  - Neutros: `canvas` (fundo da pagina), `surface` / `surface-strong` (cards, popovers), `border` / `border-strong`, `ink` (texto primario), `muted` (texto secundario), `subtle` (texto terciario/placeholder)
  - Marca: `primary` (ember, laranja) com `-hover`/`-foreground`/`-text`; `secondary` (azul) com o mesmo padrao — `-text` e sempre a variante ajustada para contraste AA quando usada como texto/link sobre a superficie (ex: no claro, `secondary-text` e mais escuro que `secondary` para passar de 4.5:1)
  - Semanticas: `success`, `warning`, `danger`, cada uma com `-foreground`/`-text` no mesmo padrao
  - Utilitarios: `ring` (foco), `overlay` (scrim de dialogs/sheets)
- Tipografia: pilha de fontes do sistema (`-apple-system, Segoe UI, Inter, Roboto...`) — sem fetch de fonte externa, zero custo de rede
- Espacamento e escala de fonte: escala padrao do Tailwind, aplicada de forma consistente (sem valores arbitrarios soltos pela UI)
- Raio: `rounded-4xl`/`rounded-5xl` para cards/paineis, `rounded-full` para pills/botoes/badges
- Sombra: `shadow-xs` (elevacao minima), `shadow-card` (cards), `shadow-raised` (dialogs/dropdowns/toasts), `shadow-glow` (destaque do botao primario) — todas usam `--c-shadow`/`--shadow-strength`, mais fortes no escuro e mais suaves no claro
- Movimento: `fade-in`, `fade-in-up`, `scale-in`, `slide-up`, `shimmer` — usados com moderacao (entrada de cards/dialogs, shimmer de skeleton) e desativados automaticamente quando o usuario tem `prefers-reduced-motion: reduce`

### Dark mode (Fase 13)

- Escuro e o tema padrao; a preferencia é lida em `components/theme/theme-script.tsx`, um `<script>` inline no `<head>` que roda **antes do primeiro paint** — le `localStorage`, cai para `prefers-color-scheme` do sistema na primeira visita, e aplica `data-theme` no `<html>` sem flash do tema errado
- `components/theme/theme-provider.tsx` expoe `useTheme()` (`theme`, `setTheme`, `toggleTheme`) e persiste a escolha em `localStorage`, sincronizando entre abas
- `components/theme/theme-toggle.tsx` e o botao de alternancia (usado no header e em `/settings`) — usa o padrao "mounted guard" para nunca causar hydration mismatch (o servidor sempre assume escuro; o cliente corrige apos montar)
- Todo componente do Design System foi construido para funcionar nos dois temas sem excecao — nenhuma cor "hardcoded" fora do sistema de tokens

### Componentes (`components/ui/*`)

Consolidados em um unico lugar — nenhuma tela renderiza mais markup "cru" duplicado (tabelas, botoes-links, checkboxes, tabs de pilula) por fora daqui:

| Componente | Arquivo | Notas |
|---|---|---|
| `Button` / `IconButton` / `buttonVariants` | `button.tsx` | variantes `primary/secondary/outline/ghost/danger`, tamanhos `sm/md/lg`, estado `loading`; `buttonVariants()` gera a mesma classe para usar em `<Link>` |
| `Card` | `card.tsx` | `padding`, `interactive` (hover-lift), `as="form"` para usar como formulario |
| `Input` / `Textarea` / `Select` / `SearchBar` | `input.tsx`, `textarea.tsx`, `select.tsx`, `search-bar.tsx` | estado `invalid`, `SearchBar` sempre com label acessivel |
| `Checkbox` / `Radio` / `Switch` | `checkbox.tsx`, `radio.tsx`, `switch.tsx` | controles custom sobre `<input>` nativo (mantém teclado/leitor de tela) |
| `Badge` | `badge.tsx` | variantes `default/primary/secondary/success/warning/danger/outline` |
| `Avatar` | `avatar.tsx` | tamanhos `sm/md/lg/xl`, `alt` real (`name`) separado das iniciais de fallback (`label`) |
| `Tabs` | `tabs.tsx` | nav em pilula dirigida por rota/query string (usada em `/me/*`, feed, calendario) — `aria-current`, nao um `tablist` de JS |
| `Dialog` / `ConfirmDialog` | `dialog.tsx`, `confirm-dialog.tsx` | portal, backdrop, foco preso (focus trap), fecha em Esc/clique fora/restaura foco ao fechar. Substituiu os dois `window.confirm()` que existiam (moderacao e sync) |
| `Sheet` | `sheet.tsx` | bottom sheet mobile-first, mesma base do `Dialog` |
| `Dropdown` / `DropdownItem` | `dropdown.tsx` | menu (usado no avatar do header: perfil/configuracoes/sair) |
| `Tooltip` | `tooltip.tsx` | CSS puro, aparece em hover **e** foco de teclado |
| `Skeleton` / `SkeletonText` / `SkeletonAvatar` / `SkeletonCard` / `SkeletonGrid` / `SkeletonTable` | `skeleton.tsx` | usados nos `loading.tsx` de cada rota |
| `EmptyState` | `empty-state.tsx` | icone + titulo + copy + acao opcional |
| `Pagination` | `pagination.tsx` | generico (`basePath`), substituiu uma versao hardcoded so para `/series` |
| `Toast` / `useToast` / `ToastProvider` | `toast.tsx` | provider global (montado em `app/layout.tsx`); substituiu ~8 implementacoes de `useState` + `<p>` de erro/sucesso espalhadas pelos formularios |
| `Alert` | `alert.tsx` | banner inline (`info/success/warning/danger`) — usado em erros de formulario (login/cadastro) |
| `Spinner` | `spinner.tsx` | usado dentro de `Button` (`loading`) |
| `Table` / `TableContainer` / `TableHead` / `TableBody` / `TableRow` / `Th` / `Td` | `table.tsx` | substituiu 8+ `<table>` "cruas" e quase identicas no workspace admin |

Icones: `components/ui/icons.tsx` — um conjunto pequeno, desenhado a mao (estilo Lucide/Feather, `stroke="currentColor"`), sem dependencia externa (o app nao tinha nenhum icone antes desta sprint).

### Acessibilidade (Fase 12)

- Contraste: paleta calibrada para AA (texto normal >= 4.5:1) nos dois temas — inclusive corrigido durante a auditoria (`secondary-text` no claro usava um azul 600 que ficava ~4.3:1 contra branco; passou para o 700, ~5.8:1)
- Foco visivel: `:focus-visible` global com anel de 2px na cor `--c-ring`, nunca aparece em clique de mouse, sempre aparece em navegacao por teclado
- `<a href="#main-content">` como skip link (primeiro elemento focavel da pagina)
- Marcos (`landmarks`): `header`, `nav` (com `aria-label` proprio para desktop/mobile/admin), `main`, `footer`
- Todo controle icone-only exige `label` (via `IconButton`) — nunca existe um botao sem nome acessivel
- Dialogs/Sheets: `role="dialog"`, `aria-modal`, `aria-labelledby`/`aria-describedby`, foco preso dentro do painel, foco devolvido ao elemento que abriu ao fechar
- Formularios: todo campo tem `<label htmlFor>` associado (antes, varios formularios usavam so `placeholder`)

### Mobile (Fase 15)

- Bottom navigation fixa (6 itens, icone + label) em telas `< md`, com `safe-area-inset-bottom` via `.safe-pb` para não colidir com a barra de gestos do iOS/Android
- Areas de toque de pelo menos 44px (`min-h-11`) em todo controle interativo
- `viewport-fit=cover` + `theme-color` por `prefers-color-scheme` no `<meta>` para a barra de status combinar com o tema

### Performance percebida (Fase 14)

- `loading.tsx` (skeletons) em todas as rotas com busca de dados relevante (`/`, `/series`, `/series/[id]`, `/feed`, `/calendar`, `/me`, `/profile/[username]`, `/lists`, `/notifications`, `/admin`) — o Next.js os usa automaticamente via Suspense enquanto o Server Component busca dados
- `not-found.tsx` e `error.tsx` proprios na raiz (nenhum dos dois existia antes)
- `getCurrentUser()` (`lib/auth/server.ts`) agora usa `cache()` do React — o header, a navbar, o bottom nav e o link de notificacoes chamavam essa funcao de forma independente na mesma renderizacao; agora a sessao/usuario e resolvida uma unica vez por request

### Limitacoes atuais

- Sem testes automatizados de acessibilidade (axe/lighthouse-ci) — validacao foi manual (contraste calculado, navegacao por teclado testada com Playwright)
- `Dropdown`/`Tooltip` sao implementacoes proprias simples (sem posicionamento inteligente tipo Floating UI) — suficientes para os usos atuais (menu do header), mas nao geral-purpose para casos com pouco espaco na tela
- Sem storybook ou galeria isolada de componentes — a documentacao dos componentes vive neste README e no proprio codigo

## Estatisticas e Insights

Modulo de estatisticas pessoais (`/me/stats`): transforma o historico de progresso do usuario (episodios assistidos, status de series) em metricas, graficos e insights automaticos. **Somente leitura** — nao cria, altera nem apaga nenhum dado; nao introduz gamificacao (sem badges, niveis ou ranking entre usuarios).

### Analytics Layer (`lib/analytics/`)

Toda a logica de calculo vive aqui, isolada das paginas React — nenhuma pagina calcula estatistica diretamente, elas so chamam `getUserStats(userId)` e renderizam o resultado.

- `dataset.ts` — **o unico lugar que consulta o banco.** Duas queries (`UserEpisodeProgress` onde `watched: true`, com o episodio/temporada/serie aninhados; e `UserSeriesStatus` do usuario, com a serie e a contagem de episodios por temporada), mais a data de cadastro do usuario, todas em paralelo (`Promise.all`). O resultado (`AnalyticsDataset`) e passado para todo o resto — nenhum outro modulo desta pasta faz uma unica query.
- `overview.ts` — Fase 3: contagens por status (concluidas/assistindo/pausadas/abandonadas/planejadas), temporadas concluidas, episodios assistidos/restantes, % medio de conclusao, media de episodios por serie, dias desde o cadastro.
- `watch-time.ts` — Fase 4: minutos/horas/dias assistidos, media por episodio e por serie.
- `genres.ts` — Fase 6: ranking de generos e percentual.
- `timeline.ts` — Fase 5: series temporais (por dia/semana/mes/ano) e `getMonthlyRecapData`/`getYearlyRecapData`, preparadas para um futuro Recap mas **nao expostas em nenhuma UI ainda** (sem geracao automatica).
- `streaks.ts` — Fase 8: sequencia atual, maior sequencia, dias ativos, primeiro/ultimo episodio assistido.
- `insights.ts` — Fase 7: insights automaticos, cada um uma regra pura e independente numa lista (`INSIGHT_RULES`) — adicionar um insight novo e so acrescentar uma funcao a lista.
- `service.ts` — `getUserStats(userId)`: o unico ponto de entrada, usado pela pagina, pela API e (no futuro) por qualquer ferramenta admin — so recebe um `userId`, nunca depende da sessao.

### Metricas disponiveis

| Categoria | Metricas |
|---|---|
| Resumo geral | series concluidas/assistindo/pausadas/abandonadas/planejadas, temporadas concluidas, episodios assistidos/restantes, % medio de conclusao, media de episodios/serie, dias desde o cadastro |
| Tempo assistido | minutos/horas/dias assistidos, media de minutos por episodio e por serie |
| Generos | ranking com contagem e percentual, genero favorito |
| Atividade temporal | episodios assistidos por dia/semana/mes/ano |
| Sequencias | sequencia atual, maior sequencia, dias ativos, primeiro/ultimo episodio assistido |
| Insights | frases automaticas geradas a partir das metricas acima |

### Metodologia (documentada porque cada escolha tem uma alternativa razoavel)

- **Fonte de verdade**: exclusivamente `UserEpisodeProgress` (`watched: true`) e `UserSeriesStatus`. `Activity`/`Review` existem e foram auditados, mas nao alimentam nenhum calculo desta sprint.
- **`watchedAt`**: `lib/progress/mutations.ts` sempre zera esse campo ao desmarcar um episodio — por isso qualquer linha com `watched: true` tem garantidamente um `watchedAt` valido, sem precisar de fallback.
- **Runtime ausente**: episodios sem `runtimeMinutes` sao **excluidos** dos calculos de tempo (nunca vira "42min" inventado); `episodesWithoutRuntime` informa quantos ficaram de fora para a UI ser transparente sobre o numero ser um piso, nao o total real.
- **Generos por episodio**: uma serie pode ter varios generos; cada episodio assistido soma 1 ponto em **cada** genero da sua serie (nao divide fracionadamente entre eles). O percentual e relativo ao total de "pontos de genero", por isso sempre soma 100% no ranking.
- **Fuso horario**: todo agrupamento por dia/semana/mes/ano usa UTC, nao o fuso do servidor nem do visitante — o mesmo historico sempre produz os mesmos buckets, custe onde custar rodar o app. Um fuso por usuario ficaria como extensao futura no mesmo `timeline.ts`.
- **Sequencia (streak)**: um "dia ativo" e um dia (UTC) com pelo menos 1 episodio assistido. A sequencia atual conta dias consecutivos terminando hoje **ou** ontem (se ainda nao assistiu nada hoje, a sequencia de ontem continua "viva" ate o fim do dia).
- **"Serie mais assistida" (insight)**: definida como a serie com mais episodios assistidos pelo usuario — nao a serie com mais episodios no catalogo.
- **Episodios restantes**: so conta series que o usuario esta acompanhando (tem um `UserSeriesStatus`) — series nunca adicionadas a nenhum status nao entram como "pendentes".

### Dashboard (`/me/stats`)

Nova aba em `/me/*` (`Estatisticas`, ao lado de Resumo/Assistindo/Concluidas/Watchlist/Listas). Secoes: Insights, Resumo Geral (com um donut de distribuicao por status), Tempo Assistido, Generos (ranking em barras), Atividade (grafico de colunas dos ultimos meses + heatmap tipo GitHub das ultimas semanas) e Sequencias. Usuario sem nenhum episodio assistido e sem nenhuma serie acompanhada ve um `EmptyState` com CTA para o catalogo, em vez de uma parede de zeros.

Graficos (`components/ui/bar-list.tsx`, `column-chart.tsx`, `donut-chart.tsx`, `heatmap.tsx`): SVG/CSS puro, sem nenhuma biblioteca de graficos — leves de proposito, consistentes com os tokens do Design System (cores via `stroke-primary`/`bg-success` etc., nunca hex hardcoded).

### Exportacao (preparado, nao implementado)

`GET /api/me/stats` retorna o mesmo objeto estruturado (`UserStats`) que a pagina renderiza — pensado como o ponto de integracao para uma futura exportacao (PDF, imagem, recap compartilhavel) consumir os numeros sem duplicar nenhum calculo. Nenhuma geracao visual (PDF/PNG) foi implementada nesta sprint.

### Performance

Uma unica chamada a `getUserStats(userId)` por carregamento de pagina — ela mesma faz so 3 queries (usuario, progresso, status) e todo o resto (generos, tempo, sequencias, insights) e computado em memoria a partir desses dois arrays, sem N+1 e sem recalcular nada em componentes separados. Deliberadamente **sem cache**: os numeros precisam refletir a marcação de episodio que acabou de acontecer; um cache (TTL curto por `userId`, invalidado nas mutacoes de progresso/status) fica documentado como proxima extensao caso um endpoint publico de recap precise de um em escala.

### Privacidade

`/me/stats` e `GET /api/me/stats` exigem sessao propria (`requireUser()`/`getApiUser()`) — estatisticas sao sempre privadas por padrao, nunca expostas no perfil publico (`/profile/[username]`) nesta sprint. Como `getUserStats` recebe um `userId` puro (nunca le a sessao internamente), a mesma funcao ja esta pronta para um futuro fluxo de compartilhamento opcional ou para uma tela administrativa global, sem precisar mudar a camada de calculo.

### Limitacoes atuais

- Recap mensal/anual: as funcoes existem (`getMonthlyRecapData`, `getYearlyRecapData`) mas nao ha nenhuma UI, geracao automatica (cron) ou notificacao associada
- Sem exportacao visual (PDF/PNG) — so o endpoint estruturado
- Sem estatisticas globais no admin nesta sprint (a camada ja suporta, falta so a tela)
- Sem comparacao entre usuarios, ranking, gamificacao ou recomendacoes — fora de escopo desta sprint (o motor de recomendacoes chegou na sprint seguinte, ver abaixo)

## Motor de recomendacoes

Sugere series para cada usuario a partir de dados ja existentes no catalogo e no historico de progresso — **sem IA, sem embeddings, sem aprendizado de maquina**. Cada recomendacao carrega um motivo explicito ("por que estou vendo isso?"), e nenhuma serie concluida ou abandonada pelo usuario aparece.

### Recommendation Layer (`lib/recommendations/`)

Nenhuma pagina React calcula recomendacao — todas passam pelo engine.

- `types.ts` — contratos compartilhados (`CandidateSeries`, `RecommendationContext`, `RecommendationProvider`, `ScoredRecommendation`, etc).
- `engine.ts` — monta o `RecommendationContext` (reutilizando o **Analytics Layer** para afinidade de genero — `fetchAnalyticsDataset`/`computeGenreStats` — e uma query de reviews positivas), roda todos os providers, combina os scores, aplica os filtros e corta no limite. E o unico lugar que decide "quais series entram na pool de candidatos".
- `providers/` — cinco providers independentes (ver abaixo), cada um implementando `run(context): ProviderSignal[]`.
- `scoring.ts` — combina os sinais de todos os providers num score final por serie (`score = soma(sinal_do_provider * peso_do_provider)`).
- `reasons.ts` — todo texto de motivo ("Porque voce gosta de X", "Semelhante a Y"...) vive aqui, nao espalhado pelos providers — muda a copy num lugar so.
- `filters.ts` — as regras de exclusao (Fase 5).
- `cache.ts` — cache em memoria por usuario (Fase 9).
- `service.ts` — `getRecommendationsForUser(userId, options)`: unico ponto de entrada, usado pela API, pelo dashboard e (futuramente) pelo admin.

### Providers (sinais disponiveis)

Auditados antes de implementar (Fase 1): o catalogo **nao tem** palavras-chave, criadores nem elenco (nao existem no schema `Series`/normalizacao do TMDb), e a tabela `Rating` existe mas nunca foi usada (avaliacoes reais vivem em `Review.rating`) — por isso os 5 providers usam apenas sinais que realmente existem:

| Provider | Sinal | Motivo tipico |
|---|---|---|
| `genre` | Afinidade de genero do usuario (reaproveita `computeGenreStats` do Analytics Layer sobre os episodios assistidos) | "Voce concluiu 3 series de Drama." / "Porque voce gosta de Drama." |
| `similar` | Sobreposicao de genero (indice de Jaccard) com series que o usuario concluiu ou esta assistindo — sem embeddings, ver metodologia abaixo | "Semelhante a Dark." |
| `popular` | `Series.popularityScore` (TMDb, via sync), normalizado dentro do pool de candidatos | "Muito popular no catalogo." |
| `rating` | `Series.voteAverage` (TMDb) **ou**, se o usuario deu review >= 4/5 a uma serie com genero em comum, um boost personalizado | "Bem avaliada (nota 8.5/10)." / "Baseado nas suas avaliacoes positivas." |
| `trending` | Proxy deterministico: series com `status: RETURNING` (em exibicao), rankeadas por popularidade, com bonus se o primeiro ano de exibicao for recente | "Em alta agora (em exibicao)." |

Pesos de cada provider ficam centralizados em `config.recommendations.weights` (`lib/config`), nunca como numero solto dentro do provider — e configuravel por env (`RECOMMENDATION_WEIGHT_GENRE`, `_SIMILAR`, `_POPULAR`, `_RATING`, `_TRENDING`), com defaults sensatos.

### Metodologia (decisoes documentadas)

- **"Series parecidas" sem IA**: como o catalogo nao tem palavras-chave/embeddings, similaridade e o indice de Jaccard entre os generos de duas series (`|intersecao| / |uniao|`). E uma aproximacao honesta, nao uma recomendacao semantica de verdade — documentado para nao ser confundido com um sistema de embeddings.
- **"Em alta" sem telemetria real**: nao existe feed de trending nem contagem de visualizacoes por serie na plataforma. O provider `trending` e um proxy deterministico e reproduzivel (mesma entrada, mesma saida sempre), nao dado de trending em tempo real.
- **Popularidade "entre usuarios"**: o provider `popular` usa a popularidade do TMDb (sinal de catalogo), nao uma contagem real de quantos usuarios do inSeries acompanham cada serie — mais preciso dizer "popular no catalogo" do que "popular entre usuarios do inSeries".
- **Motivo unico por recomendacao**: cada serie recomendada tem um `primaryReason`/`primaryProvider` (o sinal de maior peso), mas o array `reasons` completo (todos os providers que contribuiram, ordenados por contribuicao) tambem e retornado pela API — o dashboard so mostra o principal.

### Filtros (nunca recomendar)

Aplicados em `filters.ts`, em uma unica passada:

- Series **concluidas** ou **abandonadas** pelo usuario — sempre excluidas, nao configuravel (regra dura do motor).
- Series na **watchlist** (`WANT_TO_WATCH`) — excluidas por padrao, configuravel via `RecommendationOptions.excludeWatchlisted`.
- Series **assistindo no momento** — excluidas por padrao (nao faz sentido "descobrir" algo que o usuario ja esta acompanhando), configuravel via `excludeWatchlisted`/`excludeWatching`.
- Series ocultadas pelo admin: **preparado, nao implementado** — `Series` nao tem campo `hiddenByAdminAt` hoje (so `Review`/`List` tem); `filters.ts` e o unico lugar que ganharia essa linha se o campo for adicionado no futuro.

### API — `GET /api/recommendations`

Autenticado (`getApiUser()`, 401 se anonimo). Aceita `?limit=` (max 50, default 10). Retorna o mesmo objeto estruturado que o dashboard renderiza — serie, score, motivo, provider principal e a lista completa de motivos, pronto para uma futura tela de "todas as recomendacoes" ou um app externo consumir.

### Dashboard (`/me`)

Secao "Recomendado para voce" (limite de 10), com poster, titulo e motivo — some completamente se a feature flag estiver desligada ou se nao houver nenhuma recomendacao elegivel.

### Cache (Fase 9)

Em memoria, por `userId`, TTL configuravel (`RECOMMENDATION_CACHE_TTL_SECONDS`, default 300s) — mesmo padrao `globalThis` de `lib/rate-limit`/`lib/metrics`. `RecommendationCache` e uma interface: trocar por Redis no futuro e implementar a interface e trocar uma linha em `service.ts`, sem tocar no engine.

**Invalidacao real, nao só TTL**: marcar/desmarcar episodio (`toggleEpisodeProgress`), mudar status de serie (`upsertSeriesStatus`) e criar/editar/apagar review (`upsertReview`/`deleteReview`) invalidam o cache do usuario imediatamente — sem isso, completar uma serie ainda a mostraria como "recomendada" ate o TTL expirar. Validado manualmente marcando uma serie como concluida via API e confirmando que a proxima chamada teve `fromCache: false` e ja excluia a serie.

### Performance (Fase 10)

Uma pool de candidatos (`prisma.series.findMany`, ate `RECOMMENDATION_CANDIDATE_POOL_SIZE` series, default 200) e buscada **uma vez** por calculo; todos os 5 providers rodam sobre essa mesma lista em memoria — nenhum provider faz sua propria query. Reaproveita o Analytics Layer inteiro para afinidade de genero em vez de recalcular do zero.

### Feature flag (Fase 12)

`recommendations` (ja existia no sistema de feature flags desde a sprint de observabilidade, como placeholder desligado — agora que o motor esta implementado e testado, o default virou ligado, igual as outras features completas como calendario/reviews/listas/feed). Com a flag desligada, `getRecommendationsForUser` retorna `{ enabled: false, items: [] }` **sem rodar o engine** — nenhuma query de candidatos, nenhum calculo. Validado manualmente (`FEATURE_RECOMMENDATIONS=false`, reiniciando o servidor) — o smoke test roda contra um unico processo com uma configuracao fixa, entao nao alterna a flag em tempo real, igual ao caso do banco indisponivel documentado na secao de observabilidade.

### Admin (`/admin/system`)

Cartao somente leitura "Motor de recomendacoes": status da feature flag, cada provider com seu peso, quantidade de recomendacoes geradas, hits/misses do cache e o TTL configurado.

### Limitacoes atuais

- Sem IA, embeddings ou recomendacao colaborativa — por decisao explicita do escopo desta sprint
- "Similaridade" e só sobreposicao de genero — duas series de generos identicos mas tons completamente diferentes pontuam como "parecidas"
- "Em alta" e um proxy (popularidade + em exibicao), nao trending real
- Cache em memoria, por processo — nao compartilhado entre instancias; um deploy multi-instancia precisaria do Redis mencionado acima
- Sem A/B testing nem personalizacao em tempo real
- Sem UI dedicada de "ver todas as recomendacoes" — só as 10 primeiras no dashboard

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
19. observabilidade: `/api/health` responde com status/versao/ambiente/timestamp e propaga `x-request-id`; `/api/ready` responde `ready` com banco e configuracao saudaveis (a falha do banco gerando `ready` com `503` foi validada manualmente parando o Postgres, ja que o smoke test nao derruba servicos do sistema); um `x-request-id` recebido por header e reaproveitado em vez de substituido; um payload JSON invalido gera uma resposta consistente (`INTERNAL_ERROR`, sem stack trace); `/api/admin/metrics` bloqueia usuario comum (403) e o contador de requests cresce a cada chamada; `/admin/system` mostra feature flags, health/ready e metricas;
20. estatisticas: `/me/stats` e `/api/me/stats` exigem sessao (anonimo recebe redirect/401); apos assistir 1 episodio (runtime de 42min conhecido do seed), as estatisticas do usuario refletem `episodesWatched: 1`, `minutesWatched: 42`, generos calculados a partir da serie assistida, sequencia atual de 1 dia e ao menos um insight gerado; o dashboard carrega e mostra as secoes Resumo geral/Tempo assistido/Sequencias; um usuario recem-criado sem nenhum episodio assistido ve estatisticas zeradas (API) e o empty state "Ainda sem estatisticas" (dashboard).

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
