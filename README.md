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

## Sincronizacao do catalogo (TMDb) — escala e atualizacao inteligente

O catalogo cresce e se mantem atualizado via sincronizacao controlada com o TMDb, isolada em `lib/catalog/sync.ts` + `lib/tmdb/service.ts`. Nenhuma pagina ou rota chama o TMDb diretamente: tudo passa por essa camada, que registra cada execucao e nunca toca dados criados por usuarios.

**INSERIES-TMDB-CATALOG-SCALE-01** levou essa camada de "importa uma amostra pequena de series populares" para "constroi um catalogo amplo, incremental e configuravel": paginacao configuravel (nao mais uma constante fixa no codigo), o endpoint Discover TV com filtros, mais 4 fontes de descoberta (Top Rated, On The Air, Airing Today, Trending), atualizacao inteligente (evita rebaixar tudo de novo para series ja catalogadas), fila de concorrencia + retry com backoff para o rate limit do TMDb, observabilidade por execucao, e um catalogo bem mais rico de metadados — tudo sem alterar nenhuma regra de negocio, autenticacao, funcionalidade do usuario ou navegacao (a mudanca fica inteiramente dentro do pipeline de sync).

### Auditoria (Fase 1) — o que existia antes desta sprint

- `lib/catalog/sync.ts` tinha uma constante fixa `MAX_POPULAR_PAGES = 5` — o numero de paginas era sempre passado por parametro de funcao ou por argumento de CLI, nunca por variavel de ambiente
- So existia um endpoint de descoberta: `tv/popular`. Sem Discover, Top Rated, On The Air, Airing Today ou Trending
- `syncOneSeries` sempre fazia o fetch completo (detalhes + todas as temporadas + todos os episodios) para **toda** serie de uma pagina de resultados, mesmo quando a serie ja estava catalogada havia tempo e nada tinha mudado — isso e um custo de N+1 (1 chamada de detalhes + 1 chamada por temporada) que crescia a cada nova execucao do mesmo sync, sem necessidade
- Nao havia fila de concorrencia, atraso entre requisicoes nem retry — uma resposta 429 (rate limit) do TMDb simplesmente virava um erro reportado para aquela serie, sem nova tentativa
- Persistencia (`lib/catalog/repository.ts`) ja fazia upsert correto por id externo do TMDb (nunca duplicava), mas nao envolvia as escritas em transacoes, e so gravava um subconjunto pequeno de campos (poster, backdrop, overview, generos, nota, popularidade, rede — so a primeira rede, nunca a lista completa)
- `scripts/seed-catalog.ts` (script legado, distinto do pipeline de sync) so importa a primeira pagina de populares uma vez — mantido como estava, fora do escopo desta sprint

### Variaveis de ambiente

- `TMDB_API_KEY` ou `TMDB_ACCESS_TOKEN` (pelo menos uma): credenciais do TMDb. Sem nenhuma delas, todo sync (script, orquestrador ou seed de catalogo) aborta com mensagem clara e sem derrubar o restante da aplicacao
- `TMDB_BASE_URL`: base da API (padrao `https://api.themoviedb.org/3`)
- `TMDB_LANGUAGE`: idioma preferido (padrao `pt-BR`, com fallback automatico para `en-US` quando a TMDb nao tem tradução)
- `TMDB_POPULAR_PAGES` (padrao `1`): paginas buscadas por `sync:popular` quando nenhum argumento de CLI e passado. ~20 series/pagina — `TMDB_POPULAR_PAGES=25` ~= 500 series, o exemplo literal do ticket
- `TMDB_DISCOVER_PAGES` (padrao `1`): o mesmo, para `sync:discover`
- `TMDB_MAX_CONCURRENT_REQUESTS` (padrao `4`): quantas chamadas ao TMDb podem estar em voo ao mesmo tempo
- `TMDB_REQUEST_DELAY_MS` (padrao `250`): espacamento minimo entre o **inicio** de requisicoes sucessivas, mesmo dentro do limite de concorrencia
- `TMDB_MIN_VOTE_COUNT` (padrao `0`, sem filtro): series com `vote_count` abaixo disso sao ignoradas (nao contam nem como novas nem como atualizadas) em **qualquer** fonte de descoberta, nao so Discover
- `TMDB_MIN_YEAR` / `TMDB_MAX_YEAR` (sem padrao, sem filtro): restringe pelo ano de estreia (`first_air_date`); no Discover viram `first_air_date.gte`/`first_air_date.lte` nativos (o TMDb ja filtra do lado dele); nas demais fontes, o filtro e aplicado no lado do inSeries apos a resposta, ja que essas fontes nao aceitam essas datas como parametro

Todas centralizadas em `config.catalogSync` (`lib/config/index.ts`) — nenhum numero magico dentro de `lib/catalog/sync.ts` ou `lib/tmdb/service.ts`.

### Diferenca entre seed dev, seed catalog e sync

- `npm run seed:dev`: dados **fixos locais**, sem TMDb, para desenvolvimento e testes (calendario, descoberta, progresso)
- `npm run seed:catalog`: importacao **unica** de series populares do TMDb (primeira pagina), script legado mantido como estava, pensado para popular o catalogo uma vez
- `npm run sync:*`: sincronizacao **rastreavel, repetivel e configuravel** — cada execucao vira uma linha em `CatalogSyncRun`, idempotente, pensada para rodar periodicamente (manual ou, no futuro, agendada)

### Fontes de descoberta (Fase 10) — cada uma roda separadamente

| Fonte | Endpoint TMDb | Comando | `CatalogSyncType` |
|---|---|---|---|
| Populares | `tv/popular` | `npm run sync:popular [paginas]` | `POPULAR_SERIES` |
| Discover TV | `discover/tv` | `npm run sync:discover [paginas]` | `DISCOVER` |
| Mais bem avaliadas | `tv/top_rated` | `npm run sync:top-rated [paginas]` | `TOP_RATED` |
| Em exibicao | `tv/on_the_air` | `npm run sync:on-the-air [paginas]` | `ON_THE_AIR` |
| No ar hoje | `tv/airing_today` | `npm run sync:airing-today [paginas]` | `AIRING_TODAY` |
| Em alta (trending) | `trending/tv/{day\|week}` | `npm run sync:trending [paginas] [day\|week]` | `TRENDING` |
| Detalhes de series existentes | `tv/{id}` (+ temporadas/episodios) | `npm run sync:series` | `SERIES_DETAILS` |
| **Tudo, na ordem correta** | todas as 6 fontes de descoberta acima | `npm run sync:catalog` | `CATALOG_FULL` (agrega, mais uma linha por fonte) |

`sync:catalog` roda Populares → Discover → Top Rated → On The Air → Airing Today → Trending nessa ordem, agrega os totais num `CatalogSyncRun` do tipo `CATALOG_FULL` e imprime o resumo de cada fonte individualmente. Sem TMDb configurado, aborta imediatamente (nao cria uma linha por fonte a toa).

### Discover TV (Fase 4)

`fetchDiscoverTmdbSeries` (`lib/tmdb/service.ts`) aceita: `sortBy` (`popularity.desc`, `vote_average.desc`, `first_air_date.desc`, etc.), `voteCountGte`, `firstAirDateGte`/`firstAirDateLte`, `withStatus`, `withOriginalLanguage`, `withOriginCountry`, `withGenres` — mapeados 1:1 para os parametros `sort_by`, `vote_count.gte`, `first_air_date.gte`/`.lte`, `with_status`, `with_original_language`, `with_origin_country`, `with_genres` do endpoint real. `syncDiscoverSeries` ja preenche `voteCountGte`/`firstAirDateGte`/`firstAirDateLte` a partir de `TMDB_MIN_VOTE_COUNT`/`TMDB_MIN_YEAR`/`TMDB_MAX_YEAR` automaticamente; os demais filtros (genero, status, idioma, pais) sao passados por quem chama a funcao programaticamente (nao ha flags de CLI para eles ainda — se precisar, use `syncDiscoverSeries({ withGenres: "18", withOriginalLanguage: "pt" })` diretamente).

### Atualizacao inteligente (Fase 5/6) — o que muda de verdade em escala

Esta e a mudanca de maior impacto em performance: **toda fonte de descoberta agora distingue series novas de series ja catalogadas antes de decidir quanto buscar no TMDb.**

- **Serie nova** (sem `ExternalSourceMapping` ainda): recebe o tratamento completo — detalhes + todas as temporadas + todos os episodios (`fetchFullSeriesFromTmdb`). Inevitavel na primeira vez; sem isso a serie entraria no catalogo sem nenhum episodio.
- **Serie ja catalogada**: e atualizada a partir dos proprios campos do item de lista que a descoberta ja tem em maos (poster, backdrop, overview, nota, popularidade, generos) — **zero chamadas extras ao TMDb**. Nenhuma temporada ou episodio e tocado.
- Refresh completo de temporadas/episodios para series ja catalogadas continua sendo o unico trabalho de `npm run sync:series` (`syncExistingSeriesDetails`) — inalterado, existe exatamente para isso.

Na pratica: rodar `sync:popular` (ou qualquer fonte) uma segunda vez sobre um catalogo de 500 series onde 480 ja existem faz so ~25 chamadas de lista (uma por pagina) mais o fetch completo das ~20 series genuinamente novas — nao mais `1 + numero_de_temporadas` chamadas por serie *ja catalogada*, que e o que o codigo antigo fazia. Isso e o que a Fase 12 pede quando fala em "evitar N+1" e "escalar de forma eficiente".

### Rate limit e retry (Fase 7)

`lib/tmdb/rate-limit.ts` — toda chamada real ao TMDb (`lib/tmdb/service.ts`) passa por `withTmdbRateLimit`:

- **Fila de concorrencia**: no maximo `TMDB_MAX_CONCURRENT_REQUESTS` chamadas em voo ao mesmo tempo; o restante espera a vez
- **Espacamento**: `TMDB_REQUEST_DELAY_MS` entre o inicio de requisicoes sucessivas
- **Retry com backoff exponencial** (ate 3 tentativas, `500ms * 2^tentativa`): sempre para 429 (rate limit do TMDb) e para timeout/5xx; nunca para 401 (credenciais invalidas), 404 (nao encontrado) ou erro de configuracao — retentar esses nao resolveria nada
- Contadores acumulados (`requestCount`, `retryCount`, `rateLimitHitCount`, `totalRequestMs`) ficam em memoria (`globalThis`, mesmo padrao de `lib/metrics/service.ts`) e sao "diffados" antes/depois de cada sync para virar as estatisticas daquela execucao especifica
- Validado isoladamente (sem depender de rede real): concorrencia nunca excede o limite configurado; uma falha transitoria e retentada e eventualmente resolve; um 429 e retentado e contado separadamente de outros retries; um erro nao-retentavel nunca tenta de novo; apos esgotar as tentativas, o erro original e propagado (a serie daquela iteracao vira um erro isolado no resumo, nao derruba a sincronizacao inteira)

### Observabilidade (Fase 8)

Cada `CatalogSyncSummary` agora carrega um bloco `observability`: `pagesProcessed`, `requestCount`, `averageRequestMs`, `retryCount`, `rateLimitHitCount`, `lightweightUpdateCount` (quantas series ja catalogadas foram atualizadas sem nenhuma chamada extra) e `skippedCount` (quantas foram ignoradas pelos filtros de qualidade). Fica gravado em `CatalogSyncRun.metadata` (junto dos erros por serie) e no log estruturado existente (`logger.info("catalog_sync_finished", ...)`, `lib/logger`) — nenhum logger novo foi criado. Todo `npm run sync:*` imprime esse bloco no terminal ao final (`scripts/_shared/print-sync-summary.ts`, usado por todos os 8 scripts de sync para nao duplicar a formatacao 8 vezes).

### Catalogo rico (Fase 9)

Alem dos campos que ja existiam (poster, backdrop, still de episodio, generos, nota, contagem de votos, popularidade, status, rede — so a primeira), `Series` ganhou: `tagline`, `homepage`, `originCountry`, `spokenLanguages`, `numberOfSeasons`, `numberOfEpisodes`, `networks` (lista completa, a coluna singular `network` que a UI ja usa continua existindo e sendo preenchida do mesmo jeito), `productionCountries`, `productionCompanies`, `createdBy`, `logoUrl` e `keywords`. Tudo isso vem da **mesma** chamada de detalhes que ja era feita (`tv/{id}`) — `logoUrl`/`keywords` usam `append_to_response=keywords,images`, um parametro a mais na mesma requisicao, nao uma chamada extra. Nenhum desses campos e exibido em nenhuma tela ainda — e armazenamento de dados para uso futuro, deliberadamente fora do escopo desta sprint (que e sobre o pipeline de sync, nao sobre UI).

### Performance (Fase 12)

- **Sem N+1 redundante**: ver "Atualizacao inteligente" acima — o ganho real de escala vem dali, nao de paralelismo
- **Sem escrita duplicada**: idempotencia por id externo do TMDb (inalterada desta sprint, ja existia)
- **Transacoes**: `upsertNormalizedSeriesWithCounts` agora grava serie+`ExternalSourceMapping` numa transacao curta, e cada temporada+seus episodios em **outra** transacao propria (nao a serie inteira num unico escopo gigante — uma serie com muitas temporadas seguraria locks por tempo desnecessario; o corte por temporada mantem cada transacao pequena e previsivel, com timeout generoso de 20s so nessa por precaucao)

### Cookbook — importando o catalogo em diferentes escalas

```bash
# ~20 series (1 pagina, o padrao caso nenhuma variavel seja definida)
npm run sync:popular

# ~100 series
TMDB_POPULAR_PAGES=5 npm run sync:popular
# ou, sem mexer no .env, so para essa execucao:
npm run sync:popular -- 5

# ~500 series (o exemplo do proprio ticket)
TMDB_POPULAR_PAGES=25 npm run sync:popular

# ~1000 series, combinando popular + discover (evita repetir muito a mesma lista)
TMDB_POPULAR_PAGES=25 npm run sync:popular
TMDB_DISCOVER_PAGES=25 npm run sync:discover

# Tudo de uma vez, todas as fontes, na ordem correta
TMDB_POPULAR_PAGES=10 TMDB_DISCOVER_PAGES=10 npm run sync:catalog

# So atualizar quem ja esta catalogado (temporadas/episodios inclusos), sem descobrir nada novo
npm run sync:series

# Com filtro de qualidade (evita catalogar series com poucos votos ou fora de um intervalo de anos)
TMDB_MIN_VOTE_COUNT=50 TMDB_MIN_YEAR=2015 TMDB_MAX_YEAR=2026 npm run sync:discover

# Sync mais gentil com o rate limit do TMDb (menos paralelismo, mais espacamento)
TMDB_MAX_CONCURRENT_REQUESTS=2 TMDB_REQUEST_DELAY_MS=500 npm run sync:popular
```

### Modelo `CatalogSyncRun`

Registra toda execucao de sync: `source`, `type` (`POPULAR_SERIES`, `SERIES_DETAILS`, `SERIES_SEASONS`, `SERIES_EPISODES`, `FULL_REFRESH`, `TOP_RATED`, `ON_THE_AIR`, `AIRING_TODAY`, `DISCOVER`, `TRENDING`, `CATALOG_FULL`), `status` (`RUNNING`, `SUCCESS`, `FAILED`, `PARTIAL`), `startedAt`/`finishedAt`, contadores de importado/atualizado por serie/temporada/episodio, `errorMessage` e `metadata` (erros por serie + o bloco `observability`, quando houver). `/admin/sync` lista as execucoes recentes de qualquer tipo sem nenhuma mudanca de codigo — a tabela ja renderiza `run.type` como texto livre.

### Idempotencia

- Series sao casadas pelo id externo do TMDb (`ExternalSourceMapping`), nao pelo slug: se o titulo mudar no TMDb (e o slug junto), a sincronizacao **atualiza** a serie existente em vez de criar uma duplicata
- Temporadas e episodios tem duas chaves unicas cada (`seriesId+number` / `seasonId+number` e `externalSource+externalId`); o upsert verifica existencia explicitamente antes de criar/atualizar, evitando a violacao de unicidade que uma chamada ingenua de `upsert()` do Prisma causaria ao re-sincronizar a mesma temporada/episodio duas vezes
- Rodar qualquer `sync:*` varias vezes seguidas nunca duplica series, temporadas ou episodios — apenas atualiza metadados quando mudam
- O sync so escreve em `Series`, `Season`, `Episode` e `ExternalSourceMapping`; nunca cria, atualiza ou apaga `UserSeriesStatus`, `UserEpisodeProgress`, `Review`, `List`, `ListItem` ou `Activity` — progresso, reviews, listas e atividades do usuario sao sempre preservados
- Erros em uma serie especifica (404, temporada sem episodios, imagem ausente, série sem data) ficam isolados: a execucao continua para as demais e o run final fica `PARTIAL` em vez de `FAILED`

### Tratamento de erros

`lib/tmdb/service.ts` trata timeout (10s, via `AbortController`), 401 (credenciais invalidas), 404 (recurso inexistente), 429 (rate limit, agora com retry automatico — ver "Rate limit e retry" acima) e falhas de rede genericas, sempre com mensagens seguras (sem vazar a URL com a API key). `lib/catalog/sync.ts` isola cada serie individualmente: uma falha vira uma entrada em `errors` no resumo, sem interromper as demais.

### Impacto no calendario e na busca

Nenhuma fonte paralela: `/calendar`, `/api/search` e `/series` sempre leem `Series`/`Season`/`Episode` do banco. Como o sync escreve nessas mesmas tabelas (mesmo caminho de upsert usado pelo seed de catalogo e pela importacao manual via `/api/catalog/import`), qualquer serie/temporada/episodio sincronizado fica automaticamente disponivel para descoberta, filtros e calendario assim que a sincronizacao termina — sem cache ou indice paralelo para manter sincronizado.

### Jobs futuros (nao implementados nesta sprint)

`lib/jobs/registry.ts` (`futureCatalogSyncJobs`) documenta a agenda prevista para um scheduler futuro (cron, Vercel Cron ou fila), sem cron real implementado:

- `daily-popular-series-sync` (diario): `syncPopularSeries({ pages: 2 })`
- `daily-upcoming-episodes-sync` (diario): atualiza detalhes das series que usuarios estao assistindo/querem assistir
- `weekly-full-metadata-refresh` (semanal): `syncFullRefresh({ pages: 3 })`, cobrindo populares + todo o catalogo existente
- `weekly-full-catalog-sync` (semanal, novo candidato desta sprint): `syncFullCatalog()`, cobrindo todas as 6 fontes de descoberta numa unica execucao agregada

### Limitacoes atuais

- Sem UI para os novos campos ricos (tagline, homepage, networks completos, production companies, keywords, etc.) — dados capturados e persistidos, exibicao fica para uma sprint futura de UI/catalogo
- Sem UI/CLI para os filtros de genero/status/idioma/pais do Discover alem dos globais (`TMDB_MIN_VOTE_COUNT`/`TMDB_MIN_YEAR`/`TMDB_MAX_YEAR`) — quem quiser `withGenres`/`withStatus`/`withOriginalLanguage`/`withOriginCountry` chama `syncDiscoverSeries(...)` programaticamente
- `/api/admin/sync/[type]` (o gatilho manual no workspace administrativo) continua expondo so `popular` e `existing` — as novas fontes so tem CLI por enquanto, propositalmente, ja que o ticket pediu comandos de CLI e nao mudanca de navegacao/UI administrativa
- Sem cron/scheduler real — `sync:*` continua sendo disparado manualmente (ou pelo gatilho administrativo existente), com a agenda futura so documentada em `lib/jobs/registry.ts`
- Testado neste ambiente sem acesso de rede ao TMDb (sandbox sem credenciais/rede real): toda a logica de paginacao, filtros, concorrencia, retry/backoff e o caminho "TMDb nao configurado" foram validados (isoladamente, com chamadas simuladas, e via os 8 scripts de CLI abortando corretamente); o comportamento contra a API real do TMDb nao pode ser validado ponta a ponta aqui e depende de uma execucao com `TMDB_API_KEY`/`TMDB_ACCESS_TOKEN` configuradas
- Nenhuma regra de negocio, autenticacao, funcionalidade do usuario ou estrutura de navegacao foi alterada — a sprint e estritamente o pipeline de sincronizacao do catalogo

### Descoberta massiva e coverage (INSERIES-TMDB-CATALOG-COVERAGE-01)

A sprint anterior (SCALE-01, acima) trouxe seis fontes de descoberta, cada uma sincronizada **separadamente** — `sync:catalog` ate rodava todas em sequencia, mas sem consolidar os IDs entre si antes de processar. **COVERAGE-01** adiciona uma camada por cima disso: um agregador que junta as seis fontes numa unica fila deduplicada e priorizada antes de tocar o banco, alem de cadencia de atualizacao por status e retomada automatica apos interrupcao. Nenhum dos oito comandos `sync:*` da sprint anterior foi alterado — `sync:coverage` e um pipeline novo, adicional.

#### Auditoria (Fase 1)

- `sync:catalog` (`syncFullCatalog`) rodava as seis fontes uma a uma, cada uma decidindo novo-vs-existente **isoladamente** — uma serie que aparece em Popular *e* em Trending era processada (e escrita) duas vezes na mesma execucao, sem nenhuma deduplicacao entre fontes
- Sem ordem de prioridade: a ordem de processamento era so a ordem fixa das fontes, nao popularidade/votos/relevancia
- Sem cache dentro de uma execucao: se duas fontes retornassem o mesmo id, os detalhes completos podiam ser buscados duas vezes
- Sem retomada: uma interrupcao no meio de `sync:catalog` perdia todo o progresso daquela execucao — a proxima chamada comecava do zero
- Cadencia de atualizacao (Fase 6) nao existia: toda serie ja catalogada era sempre elegivel para atualizacao leve, sem levar em conta ha quanto tempo foi sincronizada pela ultima vez nem seu status (`RETURNING`, `ENDED`, `CANCELED`, etc.)

#### Agregacao de fontes (Fase 2) — `lib/catalog/aggregator.ts`

`collectCandidates(sources, cache)` busca todas as paginas configuradas das seis fontes (Popular, Discover, Top Rated, On The Air, Airing Today, Trending) e funde cada item num `Map` unico **por id do TMDb** — o id vira a chave primaria da fila, exatamente como o ticket pede. Cada candidato guarda a lista de todas as fontes que o sugeriram (`sources: DiscoverySourceKey[]`), usada tanto no relatorio quanto na priorizacao abaixo. Uma pagina que falha (rede, rate limit esgotado, etc.) vira um erro isolado — nunca aborta as demais fontes/paginas.

#### Deduplicacao (Fase 3)

A fusao acima *e* a deduplicacao: um id que aparece em duas ou mais fontes ocupa uma unica entrada no `Map`, nunca duas. `AggregationResult` expõe as estatisticas que o relatorio final (Fase 11) e os testes obrigatorios pedem: `totalCollected` (soma bruta de todas as paginas, com repeticao), `uniqueCount` (tamanho real da fila), `duplicatesRemoved` (`totalCollected - uniqueCount`) e `pagesProcessed`.

#### Priorizacao (Fase 4)

Cada candidato recebe um `priorityScore` calculado em `computePriorityScore` — a mesma forma de pontuacao ponderada ja usada pelo motor de recomendacoes (`lib/recommendations/scoring.ts`): `popularity * peso + vote_count * peso + vote_average * peso`, mais bonus fixos para series em exibicao e com episodio novo hoje. A fila final (`candidates`) sai ordenada por `priorityScore` decrescente — series mais relevantes sao processadas (e, no caso de novas series, importadas) primeiro. Pesos configuraveis via env, sem numero magico no codigo:

- `TMDB_PRIORITY_WEIGHT_POPULARITY` (padrao `1`)
- `TMDB_PRIORITY_WEIGHT_VOTE_COUNT` (padrao `0.01`)
- `TMDB_PRIORITY_WEIGHT_VOTE_AVERAGE` (padrao `5`)
- `TMDB_PRIORITY_ON_AIR_BONUS` (padrao `20`): aplicado a qualquer candidato sugerido por On The Air ou Airing Today
- `TMDB_PRIORITY_NEW_EPISODE_BONUS` (padrao `10`): aplicado so a candidatos sugeridos por Airing Today (episodio novo *hoje*, sinal mais forte que so "em exibicao")

#### Atualizacao incremental e estrategias por status (Fase 5/6) — `lib/catalog/update-policy.ts`

Para cada candidato da fila, o pipeline decide em qual dos tres caminhos ele cai — **numa unica consulta em lote** (ver "Performance" abaixo), nunca uma consulta por candidato:

- **Sem `ExternalSourceMapping`** (serie nova): fetch completo — detalhes + todas as temporadas + todos os episodios (`fetchFullSeriesFromTmdb`), igual ao caminho ja existente da sprint anterior
- **Ja catalogada e devida para atualizacao** (`isDueForUpdate`): atualizacao leve a partir dos campos que a propria fonte de descoberta ja trouxe — zero chamadas extras ao TMDb, igual ao caminho "atualizacao inteligente" da sprint anterior
- **Ja catalogada e ainda nao devida**: ignorada, contada em `skippedByCadenceCount` — nenhuma escrita, nenhuma chamada

A cadencia (`isDueForUpdate`/`getUpdateIntervalMs`) depende do `status` (`SeriesLifecycleStatus`) da propria serie e de `ExternalSourceMapping.lastSyncedAt`:

| Status | Intervalo minimo entre atualizacoes |
|---|---|
| `RETURNING` | 1 dia |
| `IN_PRODUCTION` | 1 dia |
| `PILOT` | 1 dia (nao mencionado explicitamente no ticket; tratado como `RETURNING`/`IN_PRODUCTION` por ser tao ou mais volatil que uma serie em producao) |
| `ENDED` | 7 dias |
| `CANCELED` | 30 dias |

A politica e uma funcao pura e reutilizavel (`getUpdateIntervalMs(status)`, `isDueForUpdate(status, lastSyncedAt, now?)`) — usada tanto pelo pipeline de coverage quanto pelo novo comando standalone `sync:update` abaixo.

#### `npm run sync:update` — atualizacao por cadencia, sem descoberta

`syncUpdateDue` (reusa o `CatalogSyncType` `SERIES_DETAILS` ja existente — nao introduz outro valor de enum, ja que o tipo de execucao e o mesmo, so o criterio de selecao muda) percorre **todo** o catalogo ja mapeado e aplica a mesma cadencia acima, disparando o fetch completo (`syncOneSeries`, comportamento inalterado de `sync:series`) so para quem esta de fato devido. Ao contrario de `sync:series` (`syncExistingSeriesDetails`), que sempre atualiza tudo, `sync:update` e a versao "so faz de novo se ja passou tempo suficiente".

#### Cache de execucao (Fase 7) — `lib/catalog/sync-cache.ts`

`createSyncCache()` cria um cache **novo a cada execucao** (nunca persiste entre execucoes) com tres compartimentos independentes — paginas de listagem, detalhes de serie, detalhes de temporada — cada um memorizando a `Promise` em voo pela chave (fonte+pagina, id do TMDb, id do TMDb+numero da temporada). Uma promessa que falha e removida do cache (nunca "envenena" chamadas futuras com um erro cacheado). E uma rede de seguranca (defesa em profundidade): a deduplicacao da Fase 3 e o mecanismo primario que evita buscar o mesmo id duas vezes; o cache cobre o caso em que o mesmo id precisaria ser buscado de novo por outro motivo dentro da mesma execucao (por exemplo, apos uma retomada). `stats()` expõe `hits`/`misses`, usados no relatorio final.

#### Continuacao automatica / retomada (Fase 8)

O progresso da fila inteira (`remainingQueue`, contadores acumulados, totais, erros) e salvo em `CatalogSyncRun.metadata.resumeState` a cada `TMDB_COVERAGE_BATCH_SIZE` itens processados (padrao `25`) — nunca so no final. Como a fila e feita inteiramente de dados json-serializaveis (o proprio formato de lista do TMDb, sem classes ou funcoes), ela cabe direto na coluna `Json?` existente, sem serializacao customizada.

- `npm run sync:coverage`: se ja existe uma execucao `COVERAGE` em `RUNNING` com fila pendente, **retoma** em vez de comecar uma nova (nunca reinicia do zero desnecessariamente, como o ticket pede); so cria uma execucao nova quando nao ha nada para retomar
- `npm run sync:resume`: retoma explicitamente; se nao houver nada para retomar, imprime uma mensagem clara e sai com codigo 0 (nao e um erro nao ter o que retomar)
- Um `Ctrl+C` durante `sync:coverage`/`sync:resume` imprime uma mensagem confirmando que o progresso ja esta salvo e que `sync:resume` continua de onde parou — o checkpoint mais recente ja foi persistido antes da interrupcao ser possivel notar, nunca depois

`TMDB_COVERAGE_BATCH_SIZE` controla o quao frequente e o checkpoint: menor = menos trabalho perdido numa interrupcao, ao custo de mais escritas no `CatalogSyncRun`; maior = o oposto.

#### Metricas (Fase 9)

Alem do bloco `observability` ja existente (`pagesProcessed`, `requestCount`, `averageRequestMs`, `retryCount`, `rateLimitHitCount`, `lightweightUpdateCount`, `skippedCount`), o `CoverageSummary` acrescenta `cacheHits`, `cacheMisses` e `callsSaved` (= duplicatas removidas + ignoradas por cadencia + cache hits — toda chamada ao TMDb que o pipeline evitou fazer), mais `perSourceCounts`, `totalCollected`, `uniqueCount`, `duplicatesRemoved` e `skippedByCadenceCount` no nivel do resumo. Tudo persistido em `CatalogSyncRun.metadata` a cada checkpoint (Fase 8) e no registro final.

#### CLI (Fase 10)

| Comando | Funcao | O que faz |
|---|---|---|
| `npm run sync:coverage` | `syncCoverage()` | Pipeline completo: agrega as 6 fontes, deduplica, prioriza, processa (ou retoma execucao pendente) |
| `npm run sync:update` | `syncUpdateDue()` | So atualiza series ja catalogadas que estao devidas pela cadencia — sem descobrir nada novo |
| `npm run sync:resume` | `resumeCoverage()` | Retoma a ultima execucao de coverage interrompida; sem efeito (saida 0) se nao ha nada pendente |
| `npm run sync:stats` | `getLatestCoverageRun()` + `getRecentSyncRuns()` | Imprime a ultima execucao de coverage e as 10 execucoes mais recentes de qualquer tipo |

#### Relatorio final (Fase 11) — `scripts/_shared/print-coverage-report.ts`

`sync:coverage`/`sync:resume` imprimem, ao final, linhas no formato `rotulo` + pontos + valor (o template exato pedido pelo ticket), uma por fonte mais os totais agregados, cadencia, tempo, requests, retries, rate limits e cache — por exemplo:

```
Fonte Popular.............500 series

Fonte Discover.............800 series

Duplicadas removidas......430

Fila final.................1270 series

Novas......................180

Atualizadas................1090

Ignoradas (cadencia).......842

Tempo......................00:18:34

Requests...................3642

Retries....................7

Rate Limits................2

Cache Hits..................1589

Cache Miss..................2053
```

(exemplo ilustrativo — os numeros reais dependem do catalogo e das paginas configuradas). Erros individuais (ate 10, com contagem do restante) e o status final (`SUCCESS`/`PARTIAL`/`FAILED`, com "(retomado)" quando aplicavel) fecham a saida.

#### Performance (Fase 12)

- **Sem N+1**: a decisao novo-vs-existente e cadencia-devida-vs-ignorada para a fila inteira e resolvida com **uma unica** consulta em lote (`externalSourceMapping.findMany({ externalId: { in: [...] } })`), nunca uma consulta por candidato — depois disso, o loop de processamento so consulta um `Map` em memoria
- **Sem escrita duplicada**: a deduplicacao da Fase 3 garante que cada id e processado (e, se aplicavel, escrito) uma unica vez por execucao
- **Concorrencia controlada**: reusa o mesmo limitador de taxa da sprint anterior (`TMDB_MAX_CONCURRENT_REQUESTS`, `TMDB_REQUEST_DELAY_MS`) — nenhum limite novo, nenhuma chamada fora dele
- **Uso eficiente do Prisma**: mesmas transacoes curtas e escopadas da sprint anterior (`upsertNormalizedSeriesWithCounts`); o checkpoint de retomada e um unico `update` por lote de `TMDB_COVERAGE_BATCH_SIZE` itens, nao um `update` por item

#### Cookbook — coverage em diferentes escalas

```bash
# Coverage com os padroes de paginacao ja configurados (mesmas variaveis TMDB_*_PAGES da sprint anterior)
npm run sync:coverage

# ~500 series priorizadas, combinando Popular + Discover com bastante paginacao
TMDB_POPULAR_PAGES=15 TMDB_DISCOVER_PAGES=15 npm run sync:coverage

# ~1000 series, todas as 6 fontes contribuindo
TMDB_POPULAR_PAGES=15 TMDB_DISCOVER_PAGES=15 TMDB_MIN_VOTE_COUNT=20 npm run sync:coverage

# ~5000 series — mais paginas, checkpoint mais frequente (perde menos trabalho numa interrupcao longa)
TMDB_POPULAR_PAGES=50 TMDB_DISCOVER_PAGES=50 TMDB_COVERAGE_BATCH_SIZE=50 npm run sync:coverage

# Interrompeu no meio (Ctrl+C, queda de rede, deploy)? Retomar sem perder progresso:
npm run sync:resume

# So manter o catalogo existente em dia, sem descobrir series novas
npm run sync:update

# Ver a ultima execucao de coverage e o historico recente de qualquer sync
npm run sync:stats
```

#### Limitacoes atuais (COVERAGE-01)

- Mesma limitacao de ambiente da sprint anterior: sandbox sem acesso de rede real ao TMDb. O agregador, a deduplicacao, a priorizacao, a cadencia por status, o cache e a retomada foram validados diretamente (`collectCandidates`/`runCoverageWithSources` chamados com fontes sinteticas e fixtures reais no banco local) — o caminho de fetch completo para series genuinamente novas depende de rede real e so foi validado quanto ao isolamento de erro (uma falha de rede vira um erro por item, nunca derruba a execucao)
- `/admin/sync` continua listando qualquer `CatalogSyncType` sem mudanca de codigo (inclui `COVERAGE` automaticamente), mas o gatilho manual do workspace administrativo (`/api/admin/sync/[type]`) nao ganhou uma opcao dedicada para coverage — so CLI por enquanto, mesma decisao consciente da sprint anterior
- `PILOT` recebeu cadencia diaria por interpretacao (o ticket so especifica `RETURNING`/`IN_PRODUCTION`/`ENDED`/`CANCELED`) — documentado acima
- Nenhuma regra de negocio, autenticacao, funcionalidade do usuario ou estrutura de navegacao foi alterada — a sprint e estritamente uma camada adicional sobre o pipeline de sincronizacao do catalogo

### Catalogo editorial de qualidade (INSERIES-TMDB-CATALOG-QUALITY-01)

As duas sprints anteriores resolveram "trazer muitas series" (SCALE-01) e "trazer de forma consolidada, priorizada e continua" (COVERAGE-01). **QUALITY-01** muda o objetivo de quantidade para qualidade: toda serie que passa pelo pipeline agora recebe um score editorial, passa por um filtro de curadoria antes de entrar no catalogo pela primeira vez, e sai com tags, provedores de streaming e metadados mais completos — tudo sem tocar autenticacao, navegacao ou qualquer funcionalidade existente do usuario.

#### Auditoria (Fase 1) — o que esta sprint encontrou

- `type` (TMDb: `Scripted`, `Reality`, `Miniseries`, `Documentary`, etc.) nunca era capturado, apesar de vir na mesma chamada de detalhes ja feita — um sinal forte para identificar minisseries que a sprint anterior nao aproveitava
- Streaming providers (`watch/providers`) nunca eram sincronizados — nenhum campo, nenhuma chamada
- Nao havia nenhum score agregado de qualidade nem curadoria: uma serie com `vote_count` baixo, sem imagens ou sem sinopse entrava no catalogo do mesmo jeito que qualquer outra, contanto que passasse pelo filtro de `TMDB_MIN_VOTE_COUNT`/`TMDB_MIN_YEAR` ja existente
- `logoUrl`/`keywords`/`networks` ja eram persistidos (sprint SCALE-01) mas nunca usados para nada alem de armazenamento — nenhuma derivacao, nenhuma consulta
- O pipeline de coverage (`continueCoverageRun`) nem sequer aplicava o filtro basico de qualidade (`passesQualityFilters`) que os syncs individuais (`sync:popular`, `sync:discover`, etc.) ja aplicavam — uma lacuna real entre os dois caminhos, corrigida nesta sprint

#### Quality Score (Fase 2) — `lib/catalog/quality-score.ts`

`Series.qualityScore` (0-100, persistido, recalculado a cada upsert) e a soma ponderada de 14 sinais normalizados para 0-1 (popularidade, nota, contagem de votos, recencia, status, numero de temporadas, numero de episodios, presenca de backdrop/poster/overview/logo, disponibilidade de provedores, pais de origem, idioma) dividida pela soma dos pesos usados — mesmo formato de score ja usado pela priorizacao (`lib/catalog/aggregator.ts`) e pelo motor de recomendacoes (`lib/recommendations/scoring.ts`). Cada peso e uma variavel de ambiente (`TMDB_QUALITY_WEIGHT_*`, ver tabela abaixo); os caps que normalizam popularidade/vote_count/temporadas/episodios para 0-1 sao constantes documentadas no proprio arquivo (mesmo tratamento que `SAFETY_MAX_PAGES`/`genreMap` em sprints anteriores — nao todo numero vira variavel de ambiente).

Uma atualizacao leve (lightweight, sem novo fetch de temporadas/episodios) so tem os campos do item de lista em maos — o score e calculado a partir do **valor efetivo** de cada sinal (o novo valor quando presente, senao o que ja estava persistido), nunca zerando um sinal so porque aquele payload especifico nao o carregava.

#### Curadoria automatica (Fase 3) — `lib/catalog/curation.ts`

Dois pontos de checagem, os dois controlados por `TMDB_CURATION_ENABLED` (liga/desliga tudo) e só valem para uma **serie nova** entrando pela primeira vez — nunca para uma ja catalogada (descartar retroativamente o que ja esta no catalogo seria uma purga destrutiva, fora do escopo do ticket):

1. **Nivel item de lista** (`passesListItemCuration`, antes de qualquer fetch completo): `TMDB_MIN_VOTE_AVERAGE` — nota abaixo do minimo nunca chega a gastar uma chamada de detalhes
2. **Nivel detalhe** (`passesDetailCuration`, apos o fetch completo, antes do primeiro upsert): `TMDB_CURATION_REQUIRE_IMAGE` (sem poster e sem backdrop), `TMDB_CURATION_REQUIRE_OVERVIEW` (sem sinopse), piloto abandonado (`status=PILOT` ha mais de `TMDB_CURATION_MAX_PILOT_AGE_DAYS` dias) e conteudo vazio (nenhum episodio retornado)

Uma serie reprovada nunca vira um erro no relatorio — `CurationRejectedError` e contada em `Descartadas (curadoria)`/`observability.curatedOutCount`, separada de erros de rede/API.

#### Streaming providers (Fase 4)

`fetchTmdbSeriesDetails` agora usa `append_to_response=keywords,images,watch/providers` (era so `keywords,images`) — **zero chamadas extras**, o provedor vem na mesma resposta que ja buscava logo/keywords. `Series.watchProviders` guarda a uniao de `flatrate`+`free`+`ads` (streaming/assinatura/gratuito-com-anuncio; `rent`/`buy` — transacional, nao "streaming" — sao deliberadamente ignorados) para a regiao configurada em `TMDB_WATCH_PROVIDERS_REGION` (padrao `BR`). So persiste quando existem provedores para aquela regiao (`[]` caso contrario, nunca `null`) — funciona para qualquer provedor que o TMDb retornar (Netflix, Prime Video, Disney+, Max, Apple TV+, Paramount+, Globoplay, Crunchyroll, Peacock, Hulu e qualquer outro).

#### Logos e keywords (Fase 5/6)

- `lib/catalog/image-resolution.ts` (`resolvePreferredImageUrl`): logo > poster > backdrop, a ordem de preferencia que o ticket pede para "componentes compativeis" — pronta para uso futuro, ainda nao chamada por nenhum componente (sem mudanca de UI/navegacao nesta sprint)
- `lib/catalog/repository.ts` (`findSeriesByKeyword`): consulta o catalogo por uma keyword real do TMDb (`Series.keywords`, sincronizado desde SCALE-01) — funcao pronta, ainda nao ligada a nenhuma rota; busca via `keywords: { has }` (sem indice GIN dedicado — no volume atual do catalogo um scan sequencial é suficiente; ver limitacoes)

#### Collection tags editoriais (Fase 7) — `lib/catalog/collection-tags.ts`

Tags 100% derivadas de metadados existentes, nunca uma regra manual por titulo — a mesma funcao roda para toda serie que passa pelo pipeline:

| Tag | Regra |
|---|---|
| Maratona | `numberOfEpisodes >= TMDB_TAG_MARATONA_MIN_EPISODES` (padrao 100) |
| Minissérie | `type === "Miniseries"` (TMDb) OU (1 temporada, ate `TMDB_TAG_MINISSERIE_MAX_EPISODES` episodios, status `ENDED`) |
| Baseada em Livro | keyword do TMDb contendo "based on novel/book/comic" |
| Premiada | `vote_average >= TMDB_TAG_PREMIADA_MIN_VOTE_AVERAGE` **e** `vote_count >= TMDB_TAG_PREMIADA_MIN_VOTE_COUNT` — proxy de "aclamada pela critica", nao uma alegacao de premio real (TMDb nao expoe premios) |
| Em Alta | `popularity >= TMDB_TAG_EM_ALTA_MIN_POPULARITY` |
| Longa Duração | `numberOfSeasons >= TMDB_TAG_LONGA_DURACAO_MIN_SEASONS` (padrao 5) |
| Sci-Fi / Drama / Mistério / Crime | genero (`genres`) correspondente, em pt-BR ou en-US |
| Anime | genero Animação **e** `originCountry` inclui `JP` |

#### Cobertura internacional (Fase 8)

`origin_country`, `spoken_languages`, `production_countries`, `production_companies`, `created_by`, `networks`, `status`, `homepage` e `tagline` ja vinham da sprint SCALE-01 — o unico campo que faltava, `type` (Scripted/Reality/Miniseries/Documentary/Talk Show/News/Video), foi adicionado nesta sprint (mesma chamada de detalhes, sem custo extra) e alimenta diretamente a tag "Minissérie" acima.

#### Estatisticas (Fase 9) — `lib/catalog/statistics.ts`

`computeCatalogStatistics()` — uma unica consulta (`findMany` com apenas os campos escalares/array necessarios) seguida de uma reducao em memoria (genero/pais/provedor sao colunas array — o `groupBy` do Prisma nao "explode" arrays, entao uma consulta + reduce e a unica forma de fazer isso em uma so consulta) — devolve contagem por genero, pais, idioma, status, provedor, decada de estreia e o quality score medio do catalogo inteiro. Chamada ao final de toda execucao de coverage e por `sync:stats`.

#### Catalogo inteligente (Fase 10) — `lib/catalog/smart-lists.ts`

Onze listas nomeadas, cada uma uma consulta Prisma direta (where/orderBy) sobre os campos ja persistidos — nenhuma tabela nova, nenhuma regra duplicada:

Mais Populares, Mais Bem Avaliadas, Novidades, Minisséries, Maratonas, Em Exibição, Finalizadas, Longa Duração, Curtas, Em Alta, Mais Comentadas.

Cada uma e uma funcao exportada (`listMaisPopulares()`, `listMinisseries()`, etc.) e `computeSmartListCounts()` devolve quantas series qualificam para cada uma (via `count()`, nunca buscando as linhas inteiras so para contar). Nenhuma rota nova foi criada — prontas para uma futura pagina de descoberta usar.

#### Performance (Fase 11)

- **Sem chamada duplicada**: providers/logos/keywords vem todos da mesma chamada de detalhes (`append_to_response`); o score/tags sao computados a partir de dados ja em maos (o `existingSeries` que o upsert ja buscava, so com mais colunas selecionadas — zero consultas novas por serie)
- **Cache reaproveitado**: a chamada de detalhes cacheada (Fase 7 da sprint COVERAGE-01) ja cobre o payload de providers, sem cache adicional necessario
- **Concorrencia e rate limiter**: inalterados desta sprint
- **Sem N+1**: `computeCatalogStatistics`/`computeSmartListCounts` rodam **uma vez por execucao** (nao uma vez por serie) — uma consulta agregada e onze `count()`, nunca proporcional ao tamanho do catalogo sincronizado nesta execucao

#### Observabilidade (Fase 12)

O relatorio de `sync:coverage`/`sync:resume` ganhou: `Descartadas (curadoria)`, `Economia de chamadas`, `Tempo medio/serie`, `Quality Score medio`, `Providers encontrados`, `Logos encontrados`, `Keywords sincronizadas`, `Tags geradas` — todos escopados as series tocadas **nesta execucao** — mais um resumo do catalogo inteiro (quality score medio geral, total de series, por status/decada/provedor) e a contagem de cada lista inteligente. `sync:stats` mostra a mesma visao de estatisticas/listas fora do contexto de uma execucao.

#### Variaveis de ambiente desta sprint

| Variavel | Padrao | Uso |
|---|---|---|
| `TMDB_QUALITY_WEIGHT_POPULARITY` | 1 | Peso do sinal de popularidade no Quality Score |
| `TMDB_QUALITY_WEIGHT_VOTE_AVERAGE` | 1.5 | Peso da nota media |
| `TMDB_QUALITY_WEIGHT_VOTE_COUNT` | 1 | Peso da contagem de votos |
| `TMDB_QUALITY_WEIGHT_RECENCY` | 1 | Peso da recencia |
| `TMDB_QUALITY_WEIGHT_STATUS` | 0.75 | Peso da relevancia do status |
| `TMDB_QUALITY_WEIGHT_SEASONS` | 0.5 | Peso do numero de temporadas |
| `TMDB_QUALITY_WEIGHT_EPISODES` | 0.5 | Peso do numero de episodios |
| `TMDB_QUALITY_WEIGHT_BACKDROP` | 0.5 | Peso da presenca de backdrop |
| `TMDB_QUALITY_WEIGHT_POSTER` | 0.5 | Peso da presenca de poster |
| `TMDB_QUALITY_WEIGHT_OVERVIEW` | 0.5 | Peso da presenca de sinopse |
| `TMDB_QUALITY_WEIGHT_LOGO` | 0.25 | Peso da presenca de logo |
| `TMDB_QUALITY_WEIGHT_PROVIDERS` | 0.75 | Peso da disponibilidade de provedores |
| `TMDB_QUALITY_WEIGHT_ORIGIN_COUNTRY` | 0.25 | Peso da presenca de pais de origem |
| `TMDB_QUALITY_WEIGHT_LANGUAGE` | 0.25 | Peso da presenca de idioma |
| `TMDB_CURATION_ENABLED` | true | Liga/desliga toda a curadoria automatica (Fase 3) |
| `TMDB_MIN_VOTE_AVERAGE` | 0 (sem filtro) | Nota minima para uma serie nova ser considerada |
| `TMDB_CURATION_REQUIRE_IMAGE` | true | Exige poster ou backdrop numa serie nova |
| `TMDB_CURATION_REQUIRE_OVERVIEW` | true | Exige sinopse numa serie nova |
| `TMDB_CURATION_MAX_PILOT_AGE_DAYS` | 365 | Idade maxima (dias) para um `PILOT` nao ser considerado abandonado |
| `TMDB_WATCH_PROVIDERS_REGION` | BR | Regiao do TMDb usada para `watch/providers` |
| `TMDB_TAG_MARATONA_MIN_EPISODES` | 100 | Minimo de episodios para a tag "Maratona" |
| `TMDB_TAG_MINISSERIE_MAX_EPISODES` | 8 | Maximo de episodios para a tag "Minissérie" (heuristica) e para a lista "Curtas" |
| `TMDB_TAG_PREMIADA_MIN_VOTE_AVERAGE` | 8 | Nota minima para a tag "Premiada" |
| `TMDB_TAG_PREMIADA_MIN_VOTE_COUNT` | 1000 | Votos minimos para a tag "Premiada" |
| `TMDB_TAG_EM_ALTA_MIN_POPULARITY` | 50 | Popularidade minima para a tag "Em Alta" |
| `TMDB_TAG_LONGA_DURACAO_MIN_SEASONS` | 5 | Temporadas minimas para a tag "Longa Duração" |

#### Fluxo completo desta sprint

`sync:coverage`/`sync:popular`/`sync:discover`/etc. → agrega/deduplica/prioriza (COVERAGE-01) → decide novo vs. existente (SCALE-01) → **serie nova**: curadoria por item de lista → fetch completo → curadoria por detalhe → se aprovada, calcula Quality Score + Collection Tags + persiste providers/type → upsert. **Serie existente devida**: atualizacao leve → recalcula Quality Score + Collection Tags com os valores efetivos (novo + o que ja estava persistido) → upsert. Ao final: estatisticas do catalogo + contagem das listas inteligentes, ambas no relatorio.

#### Limitacoes atuais (QUALITY-01)

- Mesma limitacao de ambiente de toda sprint anterior: sandbox sem acesso de rede real ao TMDb — a curadoria por item de lista, o Quality Score, as Collection Tags, as estatisticas e as listas inteligentes foram validados diretamente (dados sinteticos + fixtures reais no banco local); o caminho de curadoria por detalhe (que depende do fetch completo) foi validado quanto a logica pura (`passesDetailCuration` chamada diretamente com series normalizadas sinteticas), nao contra a API real
- "Premiada" e um proxy de nota+votos, nao uma fonte real de premios (o TMDb basico nao expoe isso)
- Nenhuma UI nova: `resolvePreferredImageUrl`, `findSeriesByKeyword` e as 11 listas de `smart-lists.ts` sao funcoes prontas, ainda sem nenhuma rota/pagina/componente consumindo — respeitando a restricao de nao alterar navegacao
- `keywords`/`collectionTags`/`watchProviders` sao colunas array consultadas com `has` (scan sequencial) — sem indice GIN dedicado; aceitavel no volume atual, documentado como proximo passo se o catalogo crescer muito
- Curadoria so gate a entrada de series novas — nunca remove retroativamente series ja catalogadas, mesmo que elas reprovariam nos criterios atuais
- Nenhuma regra de negocio, autenticacao, funcionalidade do usuario ou estrutura de navegacao foi alterada — a sprint e estritamente uma camada editorial sobre o pipeline de sincronizacao do catalogo

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

Tipos (`NotificationType`): `NEW_EPISODE_AVAILABLE`, `FOLLOWED_YOU`, `REVIEW_FROM_FOLLOWING`, `LIST_FROM_FOLLOWING`, `SERIES_COMPLETED`, `ADMIN_NOTICE`, `ACHIEVEMENT_UNLOCKED`.

### Servico isolado (`lib/notifications/service.ts`)

Nenhuma pagina cria notificacao diretamente — tudo passa por este servico: `createNotification`, `notificationExists` (dedup), `listNotifications`, `countUnreadNotifications`, `markNotificationRead`, `markAllNotificationsRead`, e `createAdminNotice` (fundacao do `ADMIN_NOTICE`, sem UI de broadcast ainda).

A logica de cada evento (quem notificar, com qual privacidade) fica em `lib/notifications/events.ts`, chamada pelos servicos de dominio existentes (nunca por componentes React):

- **`FOLLOWED_YOU`**: `lib/social/follow.ts` chama `notifyUserFollowed` apenas quando um novo `Follow` e criado (nunca em follow duplicado/idempotente)
- **`REVIEW_FROM_FOLLOWING`**: `lib/social/reviews.ts` chama `notifyFollowersOfPublicReview` apenas na criacao de uma review nova com `visibility: PUBLIC`; nunca em edicao. So notifica se o autor **nao** estiver com perfil privado e tiver `showActivity`/`showReviews` habilitados
- **`LIST_FROM_FOLLOWING`**: mesmo contrato, em `lib/social/lists.ts` (`notifyFollowersOfPublicList`), gated por `showLists`
- **`SERIES_COMPLETED`**: `lib/progress/mutations.ts` chama `notifySeriesCompleted` para o proprio usuario, nos dois caminhos que levam a conclusao (mudar status manualmente para `COMPLETED` ou completar via ultimo episodio assistido), sempre que o estado anterior nao era `COMPLETED`
- **`NEW_EPISODE_AVAILABLE`**: preparado em `lib/notifications/episode-availability.ts` (ver script abaixo), nao e disparado em tempo real
- **`ACHIEVEMENT_UNLOCKED`**: `lib/gamification/service.ts` chama `createNotification` diretamente (nao via `lib/notifications/events.ts`) sempre que uma conquista e desbloqueada pela primeira vez — ver `## Gamificacao` para o desbloqueio em si

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

- Flags: `recommendations`, `tvtimeImport`, `notifications`, `adminWorkspace`, `calendar`, `reviews`, `lists`, `feed`, `experimentalSearch`, `recap`, `gamification`
- Hoje sao 100% baseadas em variaveis de ambiente (`FEATURE_*`, ex: `FEATURE_RECOMMENDATIONS=true`). `tvtimeImport` e `experimentalSearch` vem desligadas por padrao (ainda nao implementadas); todas as demais — incluindo `recommendations`, `recap` e `gamification`, que comecaram como placeholders desligados em sprints anteriores — vem ligadas por padrao, pois cada uma foi implementada e testada de ponta a ponta na sua propria sprint (ver `## Motor de recomendacoes`, `## Recap` e `## Gamificacao`)
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
- `timeline.ts` — Fase 5: series temporais (por dia/semana/mes/ano) e `getMonthlyRecapData`/`getYearlyRecapData`. Essas duas funcoes ficaram preparadas mas nao usadas por uma sprint inteira; agora que o Recap existe (ver `## Recap` abaixo), ele **nao** as chama diretamente — o campo `seriesCompleted` delas na verdade significa "series com episodio assistido no periodo", nao "series concluidas", o que colidiria com o significado mais preciso que o Recap precisa. O Recap reusa os calculadores que elas tambem usam (`computeGenreStats`, `computeStreakStats`) e mantem seu proprio filtro de periodo — as duas funcoes originais continuam aqui intactas, nao removidas.
- `streaks.ts` — Fase 8: sequencia atual, maior sequencia, dias ativos, primeiro/ultimo episodio assistido. `computeStreakStats` recebe qualquer array de episodios assistidos, por isso o Recap reusa a mesma funcao so com o array ja filtrado pelo periodo (o campo `currentStreakDays` so faz sentido para "hoje", entao o Recap le apenas `longestStreakDays`/`activeDays` do resultado).
- `insights.ts` — Fase 7: insights automaticos, cada um uma regra pura e independente numa lista (`INSIGHT_RULES`) — adicionar um insight novo e so acrescentar uma funcao a lista. `getMostWatchedSeries` (usada aqui internamente) agora tambem e exportada — o Recap reusa a mesma regra de "serie mais assistida" para o periodo, em vez de redefini-la.
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

`GET /api/me/stats` retorna o mesmo objeto estruturado (`UserStats`) que a pagina renderiza — pensado como o ponto de integracao para uma futura exportacao (PDF, imagem) consumir os numeros sem duplicar nenhum calculo. O Recap (ver `## Recap` abaixo) e exatamente essa integracao para o caso de retrospectivas mensais/anuais; nenhuma geracao visual (PDF/PNG) foi implementada em nenhuma das duas sprints.

### Performance

Uma unica chamada a `getUserStats(userId)` por carregamento de pagina — ela mesma faz so 3 queries (usuario, progresso, status) e todo o resto (generos, tempo, sequencias, insights) e computado em memoria a partir desses dois arrays, sem N+1 e sem recalcular nada em componentes separados. Deliberadamente **sem cache**: os numeros precisam refletir a marcação de episodio que acabou de acontecer; um cache (TTL curto por `userId`, invalidado nas mutacoes de progresso/status) fica documentado como proxima extensao caso um endpoint publico de recap precise de um em escala.

### Privacidade

`/me/stats` e `GET /api/me/stats` exigem sessao propria (`requireUser()`/`getApiUser()`) — estatisticas sao sempre privadas por padrao, nunca expostas no perfil publico (`/profile/[username]`) nesta sprint. Como `getUserStats` recebe um `userId` puro (nunca le a sessao internamente), a mesma funcao ja esta pronta para um futuro fluxo de compartilhamento opcional ou para uma tela administrativa global, sem precisar mudar a camada de calculo.

### Limitacoes atuais

- Sem exportacao visual (PDF/PNG) — so o endpoint estruturado
- Sem estatisticas globais no admin nesta sprint (a camada ja suporta, falta so a tela)
- Sem comparacao entre usuarios, ranking, gamificacao ou recomendacoes — fora de escopo desta sprint (o motor de recomendacoes chegou duas sprints depois, o Recap logo em seguida, e a gamificacao na sprint seguinte a essa, ver abaixo)

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

## Recap

Retrospectivas mensais e anuais (`/me/recap`) construidas inteiramente a partir do historico real do usuario — **nenhum dado e inventado**, nenhuma regra de negocio existente (progresso, reviews, listas, estatisticas base) e alterada. E uma camada de leitura sobre o que ja existe, do mesmo jeito que o modulo de Estatisticas (acima) e o Motor de recomendacoes (acima) sao.

### Recap Layer (`lib/recap/`)

Nenhuma pagina React calcula recap — todas chamam `lib/recap` e renderizam o resultado.

- `types.ts` — contratos compartilhados (`RecapData`, `RecapPeriod`, `RecapOutcome`, `RecapAvailability`, etc).
- `monthly.ts` / `yearly.ts` — validacao de periodo (ano/mes validos, nao futuro) e os filtros que recortam `AnalyticsDataset` (episodios assistidos, status concluidos, reviews) para um mes ou ano especifico. Simetricos de proposito — cada um so entende o proprio tipo de periodo.
- `insights.ts` — frases narrativas do recap ("Voce assistiu X episodios em marco.", "Y foi seu genero dominante."), mesma arquitetura de regras puras e independentes do `lib/analytics/insights.ts`.
- `sharing.ts` — prepara (nao publica) a estrutura de compartilhamento (Fase 9, ver abaixo).
- `service.ts` — `getMonthlyRecap(userId, year, month)`, `getYearlyRecap(userId, year)` e `listAvailableRecaps(userId)`: os unicos pontos de entrada, usados pelas paginas e pela API. Cada um busca o `AnalyticsDataset` (via `fetchAnalyticsDataset`, a mesma funcao do Analytics Layer) mais uma unica query adicional de `Review` do usuario — a unica coisa que o Recap precisa e o dataset de estatisticas nao carrega — e computa o resto em memoria.

### De onde vem cada numero (Fase 4)

Tudo reusa calculadores que ja existem em `lib/analytics/`, so aplicados ao array de episodios/reviews **ja filtrado pelo periodo** (mes ou ano) em vez do historico inteiro:

| Campo do recap | Como e calculado |
|---|---|
| Periodo | `year` + `month` (nulo para recap anual) |
| Episodios assistidos | `episodios.length` do periodo |
| Series assistidas | titulos distintos entre os episodios do periodo |
| Series concluidas | `UserSeriesStatus` com `state: COMPLETED` e `completedAt` dentro do periodo (nao "series com episodio assistido", ver Metodologia) |
| Horas/minutos assistidos | soma de `runtimeMinutes` dos episodios do periodo |
| Dias ativos / maior sequencia | `computeStreakStats` (Analytics Layer) chamada so com os episodios do periodo |
| Generos principais | `computeGenreStats` (Analytics Layer), mesma regra, mesmo array filtrado |
| Serie mais assistida | `getMostWatchedSeries` (Analytics Layer, agora exportada) sobre os episodios do periodo |
| Episodio mais recente | o episodio do periodo com o `watchedAt` mais alto |
| Top reviews do periodo | `Review` do usuario com `createdAt` no periodo, ordenadas por nota e recencia (ate 3) |
| Insights narrativos | `generateRecapInsights` (`lib/recap/insights.ts`) |

### Metodologia (decisoes documentadas)

- **Por que nao chamar `getMonthlyRecapData`/`getYearlyRecapData` (`lib/analytics/timeline.ts`) diretamente**: essas funcoes ja existiam, preparadas desde a sprint de Estatisticas, mas o campo `seriesCompleted` delas na verdade significa "series com pelo menos um episodio assistido no periodo" — nao "series concluidas" (`UserSeriesStatus.state === COMPLETED`). Usar esse campo diretamente sob o nome "series concluidas" seria impreciso. Em vez disso, o Recap reusa os mesmos calculadores que essas funcoes tambem usam (`computeGenreStats`) e implementa seu proprio filtro de periodo com a semantica correta — as duas funcoes originais continuam no lugar, intactas, para quem precisar da versao "series com atividade no periodo".
- **`currentStreakDays` nao aparece no recap**: essa metrica so faz sentido em relacao a "hoje"; para um periodo passado (ex.: um recap de marco em julho) ela nao teria significado. O recap usa apenas `longestStreakDays`/`activeDays` de `computeStreakStats`.
- **Episodio mais recente sem titulo proprio, ate esta sprint**: `WatchedEpisodeRecord` (Analytics Layer) nao carregava o titulo do episodio, so numero de temporada/episodio. Adicionado (`episodeTitle`) porque o Recap precisava dele para "episodio mais recente" — mudanca puramente aditiva (um campo a mais no tipo e no `select` do Prisma), nenhum calculo existente muda de comportamento.
- **Reviews no recap**: usam `createdAt` da review (quando foi escrita), nao a data do episodio assistido — uma review pode ser escrita bem depois de terminar a serie.

### Filtros de periodo (Fase 3)

`GET /api/me/recap/[year]` e `/api/me/recap/[year]/[month]` validam, nesta ordem: feature flag ligada → ano e mes numericamente validos (mes entre 1 e 12) → periodo nao futuro (comparado ao UTC atual, mesma convencao de fuso do Analytics Layer). Qualquer falha retorna um erro estruturado, nunca uma excecao — ver API abaixo.

### API

- `GET /api/me/recap` — lista os periodos disponiveis (`{ years: [...], months: [...] }`), derivados dos buckets `perYear`/`perMonth` que `computeTimelineStats` (Analytics Layer) ja calcula — nenhum recap completo e gerado so para popular essa lista.
- `GET /api/me/recap/[year]` — recap anual completo.
- `GET /api/me/recap/[year]/[month]` — recap mensal completo.

Todos autenticados (`getApiUser()`, 401 se anonimo) e sempre sobre o proprio usuario da sessao — nao existe parametro de usuario na rota, entao nao ha como pedir o recap de outra pessoa (Fase 8). Com a feature flag desligada, todos retornam 404 `{ error: "feature_disabled" }`. Com periodo invalido/futuro, 400 `{ error: "invalid_year" | "invalid_month" | "future_period" }`.

### Paginas (`/me/recap`, `/me/recap/[year]`, `/me/recap/[year]/[month]`)

`/me/recap` lista os recaps anuais e mensais disponiveis (ou um empty state, se o usuario nunca assistiu nada). Cada pagina de recap (`RecapCard`, `components/recap/`) mostra: hero do periodo, numeros principais, tempo assistido, generos, sequencia, series destaque (mais assistida, mais recente, concluidas no periodo), reviews do periodo, insights e a secao de compartilhamento (abaixo). Nova aba "Recap" em `/me/*`.

### Compartilhamento (preparado, nao implementado — Fase 9 e 11)

Cada `RecapData` carrega um `sharing: { shareSlug, isPublic }`. `shareSlug` e um hash deterministico de `userId + periodo` (`lib/recap/sharing.ts`) — o mesmo usuario e periodo sempre gera o mesmo slug, mas **nada e persistido** (sem tabela/coluna nova) e **nenhuma rota publica resolve esse slug hoje**. `isPublic` e sempre `false`, fixo no codigo — recaps sao privados por padrao e nao ha nenhum fluxo nesta sprint que os publique automaticamente (Fase 11). Uma futura tela publica so precisaria de uma rota que aceite o slug e de uma forma do usuario alternar `isPublic`; nada na camada de calculo mudaria.

### Feature flag

`recap` (nova, default ligada — mesma logica das outras features completas: reusa por inteiro o Analytics Layer, ja testado). Com a flag desligada, `getMonthlyRecap`/`getYearlyRecap`/`listAvailableRecaps` retornam `{ enabled: false }` sem nenhuma query; as paginas mostram um estado "Recap indisponivel" e a API responde 404 controlado. Validado manualmente (`FEATURE_RECAP=false`, reiniciando o servidor) — mesma limitacao ja documentada para as outras flags: o smoke test roda contra um processo com configuracao fixa, entao nao alterna a flag em tempo real.

### Performance

Cada calculo de recap faz as mesmas 2 queries do Analytics Layer (`fetchAnalyticsDataset`) mais 1 query adicional de `Review` do usuario — nenhum provider/calculador faz sua propria query, tudo em memoria a partir desses arrays. `listAvailableRecaps` reusa os buckets de `computeTimelineStats`, entao listar os periodos disponiveis nunca gera um recap completo por periodo. Deliberadamente **sem cache**, mesma razao do Analytics Layer: os numeros devem refletir a ultima marcacao de episodio imediatamente.

### Limitacoes atuais

- Sem exportacao visual (PNG/PDF) nem cards para redes sociais/stories — fora de escopo desta sprint
- Compartilhamento publico preparado mas nao implementado — sem rota publica, sem toggle de visibilidade na UI
- Sem geracao automatica (cron) nem notificacao/e-mail avisando que um novo recap esta disponivel
- Sem ranking entre usuarios — cada recap e estritamente sobre o proprio historico
- "Serie mais assistida"/"generos principais" usam a mesma regra simples do Analytics Layer (contagem de episodios/generos) — nenhuma ponderacao adicional por periodo

## Gamificacao

Conquistas, badges e nivel (`/me/achievements`) construidos exclusivamente a partir de acoes reais do usuario — episodio assistido, serie concluida, review escrita, lista criada, follow. **Nunca altera** progresso, estatisticas, reviews ou listas; e uma camada que **le** eventos reais e **grava** apenas o proprio estado de conquistas (`Achievement`/`UserAchievement`), sem tocar em nenhuma tabela das outras funcionalidades.

### Gamification Layer (`lib/gamification/`)

Nenhuma pagina ou rota calcula conquista diretamente — todas chamam esta camada.

- `types.ts` — contratos compartilhados (`GamificationEvent`, `AchievementEvalContext`, `AchievementDefinition`, `AchievementsOverview`, etc).
- `achievements.ts` — `ACHIEVEMENT_DEFINITIONS`: as 15 conquistas iniciais (Fase 5), cada uma com slug, nome, descricao, icone, categoria, raridade, pontos e a regra `isUnlocked(context)`. E a unica fonte de verdade — `service.ts` faz upsert deste array na tabela `Achievement` (por `slug`), entao ajustar/adicionar uma conquista nunca precisa de migration, so mudar este arquivo.
- `milestones.ts` — construtores de regra reutilizaveis (`atLeast`, `genreAtLeast`) — a maioria das conquistas e literalmente "um numero cruzou um limite".
- `badges.ts` — metadados de raridade/categoria (rotulos, ordem) — deliberadamente sem nenhuma referencia a componente React, para a camada continuar sendo so dados.
- `levels.ts` — formula de nivel centralizada (Fase 7, ver abaixo).
- `engine.ts` — `evaluateEvent(event)`: filtra a lista de conquistas pelas que reagem a esse tipo de evento, monta so os agregados necessarios para essa categoria (nunca o quadro inteiro) e desbloqueia as que baterem a regra.
- `events.ts` — `recordGamificationEvent(event)`: unica funcao que os pontos de mutacao (progresso, reviews, listas, follow) chamam. Nunca lanca excecao — um erro na gamificacao jamais pode quebrar a acao real do usuario.
- `service.ts` — `getUserAchievementsOverview(userId)` (pagina/dashboard), `unlockAchievement(userId, slug)` (idempotente), `getGamificationAdminSnapshot()` (admin).

### Modelos (Fase 3)

`Achievement` (catalogo, somente leitura em runtime) e `UserAchievement` (`userId` + `achievementId` + `unlockedAt`, `@@unique([userId, achievementId])` — a mesma conquista nunca pode ser desbloqueada duas vezes para o mesmo usuario, e e essa unicidade, nao um `if` em algum lugar, que garante "conquista nao duplica"). `AchievementCategory` (`WATCHING`, `SOCIAL`, `COLLECTION`, `STREAK`, `REVIEW`, `SPECIAL`) e `AchievementRarity` (`COMMON`, `RARE`, `EPIC`, `LEGENDARY`) sao enums do banco. `Notification` ganhou uma coluna `achievementId` opcional, mesmo padrao das colunas `seriesId`/`reviewId`/`listId` que ja existiam.

### Conquistas iniciais (Fase 5)

| Conquista | Categoria | Raridade | Pontos | Regra |
|---|---|---|---|---|
| Primeiro Episodio | Assistindo | Comum | 10 | 1º episodio assistido |
| 10 Episodios | Assistindo | Comum | 20 | 10 episodios assistidos |
| 100 Episodios | Assistindo | Rara | 50 | 100 episodios assistidos |
| 100 Horas Assistidas | Assistindo | Rara | 50 | 100h assistidas (Analytics Layer) |
| Primeira Serie Concluida | Assistindo | Comum | 20 | 1ª serie com status `COMPLETED` |
| Concluir 10 Series | Colecao | Epica | 60 | 10 series concluidas |
| Concluir 50 Series | Colecao | Lendaria | 150 | 50 series concluidas |
| Primeira Review | Reviews | Comum | 10 | 1ª review escrita |
| Primeira Lista | Colecao | Comum | 10 | 1ª lista criada |
| Primeiro Follow | Social | Comum | 10 | 1º usuario seguido |
| 7 Dias de Sequencia | Sequencia | Rara | 30 | maior sequencia >= 7 dias |
| 30 Dias de Sequencia | Sequencia | Epica | 100 | maior sequencia >= 30 dias |
| Drama Lover | Especiais | Rara | 25 | 10 episodios do genero "Drama" |
| Comedy Lover | Especiais | Rara | 25 | 10 episodios do genero "Comedy" |
| Sci-Fi Lover | Especiais | Rara | 25 | 10 episodios do genero "Sci-Fi" |

Os nomes de genero ("Comedy", nao "Comedia") seguem o mapeamento canonico do sync real do TMDb (`lib/catalog/normalize.ts`), nao a fixture em portugues usada so por `scripts/seed-dev.ts`.

### Engine e eventos (Fase 4 e 13)

`recordGamificationEvent` e chamado a partir de `lib/progress/mutations.ts` (episodio assistido, serie concluida — inclusive quando a conclusao acontece automaticamente ao assistir o ultimo episodio), `lib/social/reviews.ts` (review criada, publica ou privada), `lib/social/lists.ts` (lista criada, publica ou privada) e `lib/social/follow.ts` (novo follow). Cada evento carrega so os ids necessarios — o `engine.ts` decide o que calcular.

**Nunca recalcula todas as conquistas**: `evaluateEvent` primeiro filtra `ACHIEVEMENT_DEFINITIONS` pelas que declaram aquele tipo de evento em `triggers`, depois busca (com uma unica query) quais dessas o usuario ja desbloqueou, e so entao monta o contexto de avaliacao — que tambem e minimo: um evento de review so conta reviews (`prisma.review.count`), um evento de lista so conta listas, etc. So `EPISODE_WATCHED` busca o dataset completo do Analytics Layer (`fetchAnalyticsDataset` + `computeWatchTimeStats`/`computeGenreStats`/`computeStreakStats`), porque e o unico evento do qual varias categorias diferentes de conquista dependem (contagem, horas, genero, sequencia) — uma unica busca, reaproveitada por todas elas, em vez de uma query por conquista.

### Badges e raridade (Fase 6)

Cada conquista tem icone, nome, descricao, categoria, pontos e raridade — sem efeitos especiais (sem animacao, sem som). A raridade e so uma cor de badge e um rotulo (`components/achievements/rarity-badge.tsx`); nao afeta pontuacao alem do valor de `points` já definido por conquista.

### Nivel (Fase 7)

Curva triangular centralizada em `lib/gamification/levels.ts`: nivel `n` comeca em `50 * n*(n-1)/2` pontos (nivel 1 = 0, nivel 2 = 50, nivel 3 = 150, nivel 4 = 300...). E puramente um indicador sobre a soma de pontos das conquistas ja desbloqueadas — nao desbloqueia nada, nao altera nenhuma funcionalidade, so muda o numero mostrado.

### Pagina (`/me/achievements`) e Dashboard (Fase 8 e 9)

`/me/achievements`: nivel + XP, contagem de conquistas desbloqueadas/total, e uma secao por categoria com as conquistas desbloqueadas e bloqueadas (bloqueadas aparecem esmaecidas com um icone de cadeado, no lugar do icone real). Nova aba "Conquistas" em `/me/*`. O dashboard (`/me`) ganhou uma secao "Conquistas" com nivel/XP, ultima conquista desbloqueada e proxima conquista sugerida (a de menor pontuacao ainda bloqueada), com link para a pagina completa.

### Notificacoes (Fase 10)

Toda conquista desbloqueada gera uma `Notification` do tipo `ACHIEVEMENT_UNLOCKED`. "Uma notificacao por conquista" e garantido estruturalmente: `unlockAchievement` so cria a notificacao dentro do mesmo fluxo que cria a linha `UserAchievement`, e essa linha tem `@@unique([userId, achievementId])` — uma segunda tentativa de desbloquear a mesma conquista (ex.: desmarcar e marcar o mesmo episodio de novo) encontra a linha existente e nao chega a criar nada. Validado manualmente e no smoke test: desmarcar/marcar o mesmo episodio repetidamente mantem exatamente 1 notificacao de conquista.

### Feature flag

`gamification` (nova, default ligada — mesma logica das outras features completas desta safra: reusa o Analytics Layer, ja testado). Com a flag desligada, `recordGamificationEvent` retorna imediatamente (nenhum evento e avaliado, nenhuma query roda) e `getUserAchievementsOverview` retorna `{ enabled: false }`; a pagina mostra "Conquistas indisponiveis" e a secao correspondente some do dashboard. Validado manualmente (`FEATURE_GAMIFICATION=false`, reiniciando o servidor): nenhuma conquista e nenhuma notificacao sao criadas ao assistir um episodio com a flag desligada — mesma limitacao documentada para as outras flags quanto a alternar em tempo real durante o smoke test.

### Admin (`/admin/system`)

Cartao somente leitura "Gamificacao": estado da feature flag (ativa/desligada), total de conquistas no catalogo e total de conquistas desbloqueadas somando todos os usuarios.

### Performance (Fase 13)

Ver "Engine e eventos" acima — o principio central e "avaliar so o que o evento pode ter mudado", nunca a lista inteira de 15 conquistas a cada acao. O catalogo (`Achievement`) e semeado por upsert idempotente na primeira leitura do processo (guardado por uma flag em `globalThis`, mesmo padrao de `lib/rate-limit`/`lib/metrics`), entao nenhum ambiente novo precisa de um passo manual de seed para a gamificacao funcionar.

### Limitacoes atuais

- Sem ranking global, competicoes, temporadas, moedas, loja, missoes diarias ou desafios semanais — fora de escopo desta sprint
- Sem recompensas financeiras nem integracao com terceiros
- Sem conquistas ocultas definidas ainda — o campo `hidden` e a logica que o respeita (`locked` nunca inclui conquistas ocultas) existem, prontos para uma conquista secreta futura
- Pontuacao e nivel sao só indicadores — não desbloqueiam nenhuma funcionalidade nem alteram limites em outras areas do app

## Assistir a seguir

Tela (`/watch-next`) pensada para ser o atalho principal do usuario: para cada serie acompanhada (assistindo ou planejada), mostra so o proximo episodio pendente — nao a lista inteira de series, nao todos os episodios. Marcar um episodio como assistido atualiza o item na hora, reutilizando integralmente a mutation de progresso ja existente.

### Query Layer (`lib/watch-next/`)

Nenhuma pagina calcula "o que assistir" diretamente — todas chamam `getWatchNextForUser(userId, options)`.

- `types.ts` — `WatchNextItem` (serie, episodio, contagens `pendingAfterNext`/`totalPending`, flags `isOverdue`/`isNew`/`isPremiere`) e `WatchNextResult` (`items` + `hasTrackedSeries`, usado para escolher qual empty state mostrar).
- `queries.ts` — `getWatchNextForUser(userId, { limit? })`: unica funcao, usada pela pagina `/watch-next`, pela secao em `/me` e por `GET /api/me/watch-next`.

### Regras de listagem (Fase 4)

Busca `UserSeriesStatus` com `state` em `WATCHING`/`WANT_TO_WATCH` (mesmo par que `lib/calendar/queries.ts` ja usa como "series ativas") — `COMPLETED`, `DROPPED` e `PAUSED` nunca aparecem. Para cada serie, um episodio so conta como pendente se **ja tiver sido lancado** (`airedAt <= agora`) e **nao estiver assistido** — um episodio futuro nunca e tratado como pendencia obrigatoria, mesmo que seja o proximo da fila. Series sem nenhum episodio pendente (aired-and-unwatched) simplesmente nao aparecem na lista — e assim que uma serie "sai" da tela ao ficar em dia.

### Proximo episodio e formato "T05 | E01 +N" (Fase 5)

Entre os episodios lancados-e-nao-assistidos de uma serie (ja ordenados por temporada/episodio, pois `season`/`episode` sao buscados com `orderBy` ascendente), o primeiro da lista e o "proximo episodio". `pendingAfterNext` e quantos ficam depois dele; `totalPending` e `pendingAfterNext + 1`. O card (`components/watch-next/watch-next-card.tsx`) renderiza isso como `T05 | E01` ou, quando ha mais pendencias, `T05 | E01 +7` — literalmente o formato pedido, calculado a partir desses dois numeros, nunca hardcoded.

### Marcar como assistido (Fase 7)

`components/watch-next/watch-next-mark-button.tsx` chama exatamente o mesmo endpoint que qualquer outro botao "marcar assistido" no app (`POST /api/episodes/[id]/progress` → `toggleEpisodeProgress`, o mesmo de `EpisodeWatchButton`) — nenhuma regra de progresso paralela foi criada. Depois de marcar, `router.refresh()` faz o servidor recalcular `getWatchNextForUser` do zero: o item avanca para o proximo episodio pendente da mesma serie, ou a serie desaparece da lista se nao sobrar nada — e como progresso/estatisticas/recomendacoes/calendario/conquistas ja leem do mesmo `UserEpisodeProgress`/`UserSeriesStatus` atualizados por essa mutation, todos eles refletem a marcacao automaticamente, sem nenhum código novo.

### Agrupamentos (Fase 8)

A pagina principal e o titulo "Assistir a seguir"; dentro dela, os itens sao divididos em duas secoes usando a flag `isOverdue` (episodio lancado ha mais de 3 dias): "Atrasados" primeiro (mais urgente), depois "Lancados recentemente". Ordenado globalmente por data de lancamento do proximo episodio (mais antigo primeiro).

### Badges (Fase 6)

`isNew` (lancado nos ultimos 3 dias) e `isPremiere` (`episode.number === 1`, estreia de temporada) combinam-se num badge: `PREMIERE` quando ambos, `NOVO` quando so recente, nenhum badge caso contrario.

### Empty states (Fase 9)

`hasTrackedSeries` (vem de `WatchNextResult`) distingue os dois casos exigidos: usuario sem nenhuma serie `WATCHING`/`WANT_TO_WATCH` ve "Voce ainda nao segue nenhuma serie." com CTA para `/series`; usuario que acompanha series mas nao tem nada pendente ve "Voce esta em dia com suas series." com CTA para `/calendar`.

### Dashboard (`/me`) e navegacao (Fase 10 e 2)

Secao "Assistir a seguir" logo apos o card de progresso medio (o primeiro conteudo relevante da area pessoal), limitada aos 5 primeiros itens, com link "Ver todos" para `/watch-next`. Nova aba "Assistir a seguir" em `/me/*`, novo item no navbar desktop e no bottom nav mobile (usando o mesmo `PlayIcon`).

### API — `GET /api/me/watch-next`

Autenticado (401 se anonimo), aceita `?limit=` (max 50) no mesmo padrao de `/api/recommendations`. Retorna `{ items, hasTrackedSeries }` — o mesmo objeto que a pagina e o dashboard renderizam.

### Mobile (Fase 11)

Lista vertical unica (sem grid), botao "Marcar assistido" em largura total no mobile (`w-full sm:w-auto`) e tamanho `lg`, sem nenhuma interacao que dependa de hover, `loading.tsx` com skeletons (`components/ui/skeleton.tsx`) enquanto a pagina busca os dados.

### Bug real encontrado e corrigido: redirecionamento de anonimos

Toda pagina protegida do app (`/me`, `/settings`, `/notifications`) e redirecionada para `/login` pelo **middleware** (`middleware.ts`), nao só pela chamada a `requireUser()` dentro da pagina — e foi exatamente essa dependencia dupla que expos um bug real nesta sprint: `/watch-next` tinha `requireUser()` na pagina (igual a todas as outras), mas **nao** estava na lista `protectedRoutes` do middleware. Como a pagina tem um `loading.tsx` (Fase 11 exige skeleton), o Next.js automaticamente envolve seu conteudo num limite de Suspense; quando o `redirect()` de `requireUser()` acontece dentro desse limite depois que o streaming ja comecou, o Next.js nao consegue mais enviar um status HTTP 307 "limpo" e degrada para um redirecionamento via `<meta http-equiv="refresh">` no HTML — o que faz um teste automatizado (ou qualquer cliente sem JavaScript) ver `200 OK` em vez de um redirect real. A correcao foi adicionar `/watch-next` a `protectedRoutes` em `middleware.ts`, para o redirecionamento acontecer ali (como em toda outra rota protegida) antes mesmo da pagina renderizar. Nenhuma outra rota foi afetada por essa mudanca de uma linha.

### Limitacoes atuais

- Series pausadas (`PAUSED`) nunca aparecem nesta sprint — o proprio ticket marcou isso como "configuravel futuramente", nao implementado agora
- Sem separacao fina "por data exata de lancamento" (ex.: agrupar por dia) — so a divisao Atrasados/Lancados recentemente (limiar de 3 dias)
- Sem swipe actions, player, streaming, integracao com plataformas ou download — fora de escopo desta sprint
- Sem notificacao especifica desta tela — reusa as notificacoes ja existentes (`SERIES_COMPLETED`, `ACHIEVEMENT_UNLOCKED`, etc.) geradas pela mesma mutation de progresso

## Application Shell — Landing publica vs. Dashboard autenticado

Principio central desta sprint: **visitante conhece o produto, usuario logado usa o produto** — as duas experiencias nunca compartilham navegacao. Antes, `Navbar`/`Header` decidiam item a item o que mostrar para anonimo vs. logado dentro da mesma barra; agora existem dois shells completamente separados, e a decisao de qual renderizar acontece uma unica vez, no topo da arvore.

### Ponto unico de bifurcacao (`components/layout/app-shell.tsx`)

```tsx
export async function AppShell({ children }: PropsWithChildren) {
  const user = await getCurrentUser();
  return user ? <DashboardShell>{children}</DashboardShell> : <LandingShell>{children}</LandingShell>;
}
```

`app/layout.tsx` continua chamando so `<AppShell>{children}</AppShell>` — nenhuma pagina precisou saber qual shell esta "dentro". A mesma logica se repete, isolada, em `app/page.tsx` (`getCurrentUser()` → `<DashboardHome />` ou `<LandingPage />`), pois `/` e a unica rota cujo **conteudo**, e nao so a moldura, muda com o login.

### `LandingShell` (publico)

`LandingHeader` (logo + `ThemeToggle` de 2 estados + botoes Entrar/Criar conta) + `<main>` + `Footer`, sem sidebar, sem bottom nav, sem qualquer elemento que sugira "sistema interno". `components/landing/landing-page.tsx` monta a Landing em si: Hero/CTA (com os contadores reais do catalogo, reaproveitados da home antiga), 4 cards de Beneficios, uma secao "Demonstracao" com 6 series populares reais (`searchSeries({ sort: "popular" })` + `SeriesCard`, zero mock), os 6 cards de Recursos que ja existiam, uma secao de Depoimentos explicitamente marcada como placeholder ("Depoimentos ilustrativos — a comunidade real ainda esta crescendo.", para nao insinuar avaliacoes reais que nao existem), FAQ em `<details>` nativos, e uma CTA final.

### `DashboardShell` (autenticado)

Sidebar fixa (desktop) + `DashboardHeader` (topo minimalista) + conteudo + `BottomNav` (mobile) — os tres nunca aparecem para visitantes, porque `DashboardShell` inteiro so e alcancado quando `getCurrentUser()` retorna um usuario.

### Sidebar (`components/layout/sidebar.tsx`)

Client component, fixa a esquerda em telas `lg`+ (escondida abaixo disso — o mobile usa `BottomNav`). Item ativo calculado por `usePathname()` (prefixo de rota, nao mais uma prop `active` manual por pagina como no antigo `MeTabs`). Itens: Dashboard, Assistir a seguir, Calendario, Catalogo, Feed, Recomendacoes, Estatisticas, Recap, Conquistas, Listas, Notificacoes e, condicionalmente, Admin (`canAccessAdminWorkspace(user.role)`, mesma checagem de RBAC ja usada no workspace administrativo). Deliberadamente **sem** Perfil e **sem** Configuracoes — os dois migraram para o menu do Avatar (Fase 6/10 do ticket sao explicitas sobre isso, mesmo a lista sugerida da Fase 5 citando Configuracoes). Colapsavel (botao no rodape, persistido em `localStorage["inseries-sidebar-collapsed"]`); colapsada, mostra so icones com `title` para acessibilidade.

### Header e menu do Avatar

`DashboardHeader` so mostra a logo em telas menores que `lg` (a Sidebar ja mostra a logo em telas maiores) e empurra notificacoes + `UserMenu` para a direita. `UserMenu` (`components/layout/user-menu.tsx`) agora exibe avatar + nome (+ cargo, quando admin/moderador) e abre um dropdown com: bloco de identidade, Meu perfil, Configuracoes, seletor de tema (`ThemeMenuItems`, 3 opcoes) e Sair — nenhuma dessas acoes tem mais espaco reservado na Sidebar.

### Tema — dark real como padrao (Fase 7)

`ThemeMode` agora tem 3 estados (`"light" | "dark" | "system"`), nao 2. Antes, a ausencia de preferencia salva fazia o boot script (`theme-script.tsx`) inferir de `prefers-color-scheme` — ou seja, um visitante com SO em modo claro via o app claro na primeira visita, apesar do dark ser "o padrao pretendido". Agora a ausencia de valor salvo resolve para `"dark"` incondicionalmente; `"system"` so e alcancado se o usuario escolher essa opcao explicitamente no menu do Avatar, e so nesse caso um listener de `matchMedia` acompanha mudancas do SO em tempo real. `ThemeToggle` (2 estados, usado so no `LandingHeader`) e `ThemeMenuItems` (3 estados, usado no `UserMenu`) consomem o mesmo `useTheme()`.

### Dashboard Home (`components/dashboard/dashboard-home.tsx`, Fase 8)

`/` autenticado renderiza 8 cards (`Promise.all`, sem cascata de round-trips): Assistir a seguir, Proximos lancamentos, Recomendacoes, Estatisticas, Conquistas, Recap, Feed, Notificacoes. Nenhum calculo novo — cada card chama exatamente o mesmo service da pagina dedicada do modulo (`getWatchNextForUser`, `getUpcomingEpisodesForUser`, `getRecommendationsForUser`, `getUserStats`, `getUserAchievementsOverview`, `listAvailableRecaps`, `getRecentActivityForUser`, `listNotifications`/`countUnreadNotifications`), so que num teaser (2-3 itens + link "Ver tudo"). A pagina antiga `/me` continua existindo, inalterada e acessivel por URL direta — ela so deixou de ser o item principal de navegacao, papel que agora e do proprio `/`.

### Identidade por modulo, nao paginas genericas (Fase 9)

Nenhuma logica mudou — so o rotulo (`eyebrow`) e, no caso do catalogo, o titulo, para reforcar que cada modulo e um produto proprio dentro do hub: Calendario → "Timeline", Feed → "Rede social", Estatisticas → "Analytics", Conquistas → "Colecao", Listas → "Cards", Catalogo → "Exploracao" (titulo tambem virou "Catalogo"), Assistir a seguir → "Foco", Recap → "Retrospectiva".

### Mobile (Fase 11)

`BottomNav` (`components/layout/bottom-nav.tsx`) agora recebe `username` como prop em vez de chamar `getCurrentUser()` — so e renderizada dentro do `DashboardShell` autenticado, entao a busca de usuario ja aconteceu uma vez, no shell. 7 itens espelhando o topo da Sidebar (Home, A seguir, Buscar, Calendario, Feed, Listas, Perfil); breakpoint alinhado com a Sidebar (visivel abaixo de `lg`, some a partir de `lg`).

### Nova rota: `/recommendations`

A Sidebar sugeria "Recomendacoes" como item proprio, mas so existia como secao dentro de `/me`. Pagina nova e fina, reusando `getRecommendationsForUser` sem nenhuma regra nova; adicionada a `protectedRoutes` do `middleware.ts` desde a criacao, para nao repetir o bug de redirecionamento (`loading.tsx` + Suspense degradando `requireUser()` para um refresh via meta tag) ja documentado na sprint de Assistir a seguir.

### Arquivos removidos

`components/layout/navbar.tsx` e `components/layout/header.tsx` foram deletados — totalmente substituidos pelo par Sidebar/DashboardHeader (autenticado) e LandingHeader (publico). Confirmado por busca que nenhum outro arquivo os importava antes da remocao.

### Limitacoes atuais

- Depoimentos da Landing sao placeholders explicitos ("em breve") — nao ha ainda coleta real de avaliacoes de usuarios
- Sem multiplos workspaces, personalizacao/drag-and-drop da Sidebar, temas customizados ou layouts salvos — fora de escopo desta sprint, por decisao explicita do ticket
- Transicoes reusam animacoes ja existentes no Tailwind config (`fade-in`, `fade-in-up`, `slide-up`, `shimmer`) — nenhuma animacao nova foi criada
- Nenhuma regra de negocio, schema ou mutation foi alterada — a sprint e estritamente shell/navegacao/tema

## Experiencia cinematografica — catalogo como protagonista visual

Principio central desta sprint (INSERIES-CINEMATIC-EXPERIENCE-FOUNDATION-01): o catalogo — posteres, backdrops, stills — deixa de ser um detalhe de card e passa a ser o elemento visual dominante de toda a aplicacao. Nenhuma regra de negocio mudou; o que mudou foi quanto espaco e prioridade essas imagens (ja existentes no schema — `Series.posterUrl`/`backdropUrl`, `Episode.stillUrl`) recebem em cada tela.

### Auditoria (Fase 1)

Antes de qualquer implementacao, a auditoria visual identificou: Landing sem hero real (so um card de texto); `SeriesCard`/`RecommendationCard`/`WatchNextCard`/`EpisodeCalendarCard` usando `background-image` inline em vez de `next/image` (sem lazy loading, sem `sizes`, sem otimizacao); pagina da serie sem poster nem backdrop de verdade (so uma imagem de fundo esmaecida); `Episode.stillUrl` existia no schema desde sempre mas **nunca era populado** — nem pelo seed dev, nem pelo sync real do TMDb (`lib/catalog/repository.ts` gravava `stillUrl: null` no import, e `Episode` (tipo usado pela pagina da serie) nem tinha o campo); catalogo com paginas muito parecidas (mesma estrutura de card, so trocando o conteudo).

### Primitivas de imagem (`components/media/`)

Toda imagem do catalogo passa por dois componentes, nunca por `background-image` inline:

- `PosterImage`/`BackdropImage` (`poster-image.tsx`) — `next/image` com `fill`, `sizes` calculado por contexto de uso, e fallback: se `src` for vazio **ou** o carregamento falhar (`onError`), renderiza um gradiente tematico com `TvIcon` + o `alt` — nunca um icone de imagem quebrada, nunca um retangulo vazio (Fase 10).
- `Carousel`/`CarouselItem` (`carousel.tsx`) — a prateleira horizontal usada por todos os carrosseis. Scroll nativo com `snap-x snap-mandatory` (funciona em touch sem nenhum JS extra); setas de navegacao aparecem so no hover em desktop (`lg:flex`, escondidas por padrao).
- `SeriesPosterCard` (`series-poster-card.tsx`) — o tile de poster usado nos carrosseis e em "Series semelhantes": poster + nota, sem mais nenhum texto ate o hover.

### Landing — Hero cinematografico + carrosseis (Fase 2/3/4)

`LandingPage` busca a serie mais popular do catalogo (`searchSeries({ sort: "popular" })[0]`) e usa o **backdrop real dela** como Hero em tela cheia (`min-h-[70vh]`, `min-h-[80vh]` em telas maiores) — nunca uma imagem estatica inventada. Gradientes (`bg-gradient-to-t`/`bg-gradient-to-r`, ambos usando o token `canvas` do tema) escurecem o canto onde o texto fica, mantendo o resto do backdrop visivel. Abaixo do Hero, 5 secoes usam `Carousel` sobre queries diferentes do mesmo `searchSeries` ja existente (Fase 9's "identidade por secao", sem nenhuma query nova): Em Alta (`sort=popular`), Lancamentos (`sort=latest`), Mais Bem Avaliadas (`sort=rating`), Em Exibicao (`status=RETURNING`), Finalizadas (`status=ENDED`). Beneficios/Recursos/Depoimentos/FAQ (da sprint anterior) continuam existindo, agora abaixo dos carrosseis.

**Bug real encontrado e corrigido**: o Hero inicialmente renderizava com o backdrop completamente invisivel (so o gradiente escuro aparecia). Causa: o container usava `min-h-[70vh]` (uma altura minima, nao uma altura definida) enquanto o backdrop e o bloco de texto usavam `position: relative` + `h-full` — porcentagem de altura contra um container sem altura definida resolve para `auto`/0 em vez do valor esperado, entao a imagem (que usa `fill`, absoluta dentro do seu proprio wrapper) colapsava para 0px de altura. Corrigido tornando todas as camadas do Hero (backdrop, gradientes, texto) `absolute inset-0` dentro do container `min-h-[70vh]` — so o container define altura; todo o resto preenche 100% dela de forma inequivoca.

### Catalogo e cards de series (Fase 5)

`SeriesCard` deixou de ser um card com `aspect-[5/3]` + texto abaixo; agora e poster-first (`aspect-[2/3]`), com status e nota sobrepostos no topo do poster, titulo/ano/plataforma sobre um gradiente na base, e generos revelados so no hover (`opacity-0 group-hover:opacity-100`) — bem menos texto sempre visivel, mais imagem. `/series` foi de 3 para ate 5 colunas (`sm:3 lg:4 xl:5`) para acomodar o formato retrato. `RecommendationCard` (ja era poster-first) so trocou o `background-image` por `PosterImage`.

### Pagina da serie — cinematografica (Fase 6)

Hero de tela cheia com `BackdropImage` (`aspect-[3/4]` no mobile, `aspect-[16/6]` no desktop), gradiente, poster grande sobreposto por cima do backdrop (`-mt-24`/`-mt-32`, escondido no mobile por espaco), titulo grande, botoes de status em `size="md"` (antes `sm`). Ordem das secoes abaixo do Hero, exatamente como pedido: Temporadas (cada `EpisodeRow` agora mostra o still do episodio) → Reviews → **Listas** (nova secao "Aparece nestas listas", via `getPublicListsContainingSeries` — query nova mas so leitura, mesmo padrao de `listPublicLists`, nenhuma regra de negocio nova) → **Series semelhantes** (carrossel via `searchSeries({ genre: series.genres[0] })`, excluindo a propria serie — reaproveita a busca existente, nao o motor de recomendacoes).

### Dashboard e Watch Next (Fase 7/8)

O Dashboard Home (`/`) nao precisou de nenhuma mudanca propria — como cada card (`WatchNextCard`, `EpisodeCalendarCard`, `RecommendationCard`, `ActivityCard`) ja é reaproveitado ali, a atualizacao visual desses componentes se propaga automaticamente para o hub. `WatchNextCard` ganhou poster maior (`PosterImage`, sem mais o still dividido 50/50) e uma barra de progresso fina (proporcao `1 / totalPending`, o "1" sendo o proprio episodio prestes a ser marcado) alem do texto "N episodio(s) restante(s)" ja existente. `ActivityCard` (Feed) ganhou uma miniatura de poster para atividades ligadas a uma serie (usa `posterUrl`, que ja vinha selecionado na query da activity, nenhum campo novo).

### `stillUrl` — campo que existia mas nunca era usado

`Episode.stillUrl` sempre existiu no schema, mas o tipo `Episode` (`lib/types.ts`, usado pela pagina da serie) nao tinha o campo, e o import real do TMDb (`lib/catalog/repository.ts`) gravava `stillUrl: null` incondicionalmente. Corrigido: `Episode.stillUrl` agora existe (opcional, para nao quebrar `lib/catalog/mock-data.ts`), `normalizeTmdbEpisode` mapeia `still_path` do TMDb, e o import grava `episode.stillUrl || null` de verdade. `lib/watch-next` e `lib/calendar/queries.ts` ja liam esse campo direto do Prisma havia sprints; so a pagina da serie e o catalogo TMDb estavam com essa lacuna.

### Skeletons especificos (Fase 13)

`SkeletonPosterGrid` (grade `aspect-[2/3]`, mesmas colunas do catalogo/recomendacoes) e `SkeletonCarouselRow` (prateleira horizontal de tiles `aspect-[2/3]`) — usados por `app/series/loading.tsx`, `app/series/[id]/loading.tsx`, `app/recommendations/loading.tsx` e `app/loading.tsx` (o loading de `/`, que precisa funcionar tanto para a Landing quanto para o Dashboard — usa um banner grande + duas prateleiras, uma forma neutra que serve para os dois).

### Performance e imagens (Fase 14)

`next.config.ts` mantem `remotePatterns` para `image.tmdb.org` (fotos reais em producao) e adiciona `dangerouslyAllowSVG` + uma CSP restrita (`script-src 'none'; sandbox;`) exclusivamente para as artes locais geradas em `/dev-media` (ver abaixo) — nunca para SVG de origem externa/nao confiavel. Todo uso de imagem passa por `next/image`: `sizes` calculado por contexto (poster de card, poster de carrossel, backdrop full-bleed) para nunca baixar mais resolucao que o necessario; `priority` so no Hero e nos primeiros itens do primeiro carrossel (acima da dobra) — todo o resto usa lazy loading (padrao do `next/image`).

### Dev media — por que SVGs gerados localmente (`public/dev-media/`)

Este ambiente de desenvolvimento nao tem acesso de rede para `image.tmdb.org` (bloqueado pela politica de rede do sandbox). Como o catalogo real (via `lib/tmdb` + sync) so preenche `posterUrl`/`backdropUrl`/`stillUrl` com fotos reais quando ha acesso a API do TMDb, `scripts/generate-dev-media.mjs` gera localmente um pequeno conjunto de artes abstratas (gradiente + formas, sem nenhum texto — ver "bug real" abaixo) para as 5 series fixas do `seed:dev`, e `npm run seed:dev` grava esses caminhos locais (`/dev-media/*.svg`) nos mesmos campos que o sync real usaria. Nenhum componente sabe a diferenca — `PosterImage`/`BackdropImage` tratam um caminho local exatamente como tratariam uma URL do TMDb. Em producao, com `TMDB_API_KEY` configurada, o sync grava fotos reais nesses mesmos campos e a arte gerada nunca e usada.

**Bug real encontrado e corrigido**: a primeira versao do gerador (`generate-dev-media.mjs`) desenhava o titulo da serie dentro do proprio SVG do poster/backdrop. Como todo componente que usa essas imagens (`SeriesCard`, `SeriesPosterCard`, Hero da Landing, Hero da pagina da serie) **ja** sobrepõe o titulo real como HTML por cima da imagem, o resultado era o titulo aparecendo duas vezes, sobreposto. Corrigido removendo o texto do SVG — a arte gerada agora e puramente abstrata (gradiente + formas), do jeito que uma foto real do TMDb tambem seria (sem nenhum texto embutido).

### Limitacoes atuais

- Sem trailers, player, autoplay ou qualquer integracao de streaming/video — fora de escopo explicito do ticket
- Sem geracao de imagem por IA nem wallpapers customizados — a arte de desenvolvimento e deliberadamente simples (gradiente + iniciais), pensada para ser substituida por fotos reais do TMDb em producao, nao para parecer uma foto de verdade
- `Season.posterUrl` existe e e gravado (seed e sync), mas nenhuma tela ainda usa o poster por temporada separadamente do poster da serie — nao fazia parte do escopo desta sprint
- Sem logo por serie (campo nao existe no schema do TMDb usado aqui) — a Fase 10 permite "quando disponivel", e para este catalogo nunca esta
- Nenhuma regra de negocio, schema ou mutation foi alterada — a sprint e estritamente visual/imagens/performance de carregamento

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

## Catalogo Inteligente na interface (INSERIES-CATALOG-INTELLIGENCE-EXPERIENCE-01)

As tres sprints anteriores (SCALE-01, COVERAGE-01, QUALITY-01) enriqueceram o catalogo — Quality Score, Collection Tags, Streaming Providers, Keywords, Smart Lists, metadados internacionais — mas tudo isso vivia só no banco, invisivel para quem usa o app. Esta sprint conecta essa camada de dados a interface, sem alterar autenticacao, navegacao, permissoes, sincronizacao ou schema (alem de nenhuma coluna nova — os campos ja existiam desde as sprints anteriores).

### Auditoria (Fase 1) — o que a interface nao mostrava

O tipo `Series` (`lib/types.ts`), usado por toda a UI, e os dois mappers que o alimentam (`toSeriesView` em `lib/catalog/repository.ts`, `toSeriesSummary` em `lib/discovery/search.ts`) simplesmente nao expunham `qualityScore`, `collectionTags`, `watchProviders`, `keywords`, `type`, `logoUrl`, `originCountry`, `spokenLanguages`, `createdBy`, `networks`, `productionCompanies`, `productionCountries`, `tagline` ou `homepage` — mesmo esses campos ja estando na tabela `Series` havia duas sprints. `SeriesCard`, `SeriesPosterCard`, `RecommendationCard` e `WatchNextCard` (todo componente que renderiza uma serie) eram, portanto, becos sem saida para esses dados. Essa auditoria foi o primeiro passo: sem estender o tipo `Series` e os dois mappers, nenhuma das fases seguintes seria possivel.

### Plumbing (pre-requisito das Fases 2-10)

- `lib/types.ts`: `Series` ganhou os 14 campos acima (a maioria `string[]` obrigatorio, default `[]` — nunca `undefined`, para a UI nunca precisar de `?? []` espalhado)
- `toSeriesView`/`toSeriesSummary`: passaram a copiar esses campos do model do Prisma (que ja os tinha) — nenhuma consulta nova, so mais linhas de mapeamento
- `lib/recommendations/types.ts`/`engine.ts`: `CandidateSeries`/`CANDIDATE_SELECT` ganharam `qualityScore`, `collectionTags`, `watchProviders`, `logoUrl` — puramente aditivo, `scoring.ts`/`engine.ts` continuam ignorando esses campos para fins de ranking
- `lib/catalog/mock-data.ts`: as 3 series de fallback (usadas só quando o banco esta indisponivel) ganharam os mesmos campos, com valores ilustrativos

### Hero Inteligente (Fase 2) — `components/landing/landing-page.tsx` (`pickHero`)

O Hero da Landing deixou de fixar sempre a serie mais popular. Agora: busca um pool das series com maior Quality Score (`sort=quality`, novo — ver Fase 8), filtra as que atingem um piso minimo (`HERO_MIN_QUALITY_SCORE`, evita destacar series de baixa qualidade) e escolhe uma por rotacao horaria determinista (`Math.floor(Date.now() / 3600000) % pool.length`) — muda ao longo do tempo, mas nao a cada reload/requisicao. Se nenhuma serie atingir o piso (catalogo novo, sem series pontuadas ainda), cai de volta para a serie mais popular — o Hero nunca fica vazio.

### Smart Lists Reais (Fase 3/11) — Landing reorganizada

A Landing trocou 5 secoes ad-hoc (sorts genericos: popular/latest/rating/status) por 10 secoes que chamam diretamente o motor de Smart Lists (`lib/catalog/smart-lists.ts`, criado na sprint QUALITY-01, agora finalmente usado): **Mais Populares, Mais Bem Avaliadas, Em Alta, Novidades, Maratonas, Minisséries, Curtas, Baseadas em Livros, Premiadas, Longa Duração** — os mesmos nomes do ticket. Duas listas novas (`listBaseadasEmLivros`, `listPremiadas`) foram adicionadas ao motor, seguindo o padrao ja estabelecido (where/orderBy sobre `collectionTags`). Cada secao so aparece se tiver pelo menos uma serie (sem secao vazia). `fetchSmartList` (a query por tras de cada lista) deixou de incluir temporadas/episodios — nenhum card de carrossel precisa disso, e evitar esse join em 10 listas por carregamento de pagina e o ganho de performance real desta fase (Fase 12).

### Collection Tags na UI (Fase 4) — `components/media/collection-tag-badge.tsx`, `lib/catalog/tag-labels.ts`

Cada uma das 11 Collection Tags (`lib/catalog/collection-tags.ts`, sprint QUALITY-01) ganhou uma combinacao propria de cor (das 7 variantes de `Badge` já existentes) + icone (do set ja existente em `components/ui/icons.tsx`, mais um `BookIcon` novo) — nunca a mesma aparencia repetida. Aparecem: no Hero (ate 3), nos cards do catalogo/recomendacoes (no hover, ate 2 — trocam de lugar com os generos, nunca os dois ao mesmo tempo), na Landing (dentro dos cards de carrossel, so a tag de maior prioridade) e na pagina da serie (todas).

### Providers e Logos (Fase 5/6) — `components/media/provider-badge.tsx`, `components/media/series-logo.tsx`

**Providers**: `Series.watchProviders` (so nomes, sincronizados desde QUALITY-01 — nunca um caminho de logo, capturar isso exigiria tocar o pipeline de sync TMDb, fora do escopo desta sprint) viram um badge colorido por marca (`lib/catalog/provider-labels.ts`, cor + inicial — nao um logo oficial hotlinkado, decisao documentada abaixo) com um "+N" quando ha mais do que o limite exibido. Só aparecem quando ha provedores sincronizados (nunca um placeholder vazio).

**Logos**: `SeriesLogoOrTitle` decide, por serie, entre logo oficial (`logoUrl`) e titulo em texto — nunca os dois ao mesmo tempo (`Nunca duplicar informacao` do ticket). Quando ha logo, o titulo em texto vira um `<span className="sr-only">` (preserva acessibilidade sem duplicar visualmente). Se a imagem do logo falhar ao carregar, cai para o texto automaticamente (mesmo padrao de fallback gracioso de `PosterImage`/`BackdropImage`). Usado no Hero e no cabecalho da pagina da serie.

### Pagina da Serie Enriquecida (Fase 7)

Cabecalho: badge de Quality Score (ao lado do status/nota), logo-ou-titulo, Collection Tags, Providers. Nova secao **Producao** (so aparece se houver pelo menos um dado): Criadores, Networks, Produtoras, Idiomas falados, Keywords reais do TMDb (cada uma linkando para `/series?keyword=...` — Fase 8) e link para o site oficial (`homepage`), quando existir. Card "Resumo" ganhou Tipo (`type`) e Pais de origem. Nada foi removido — so adicionado, condicionalmente, para nunca poluir a interface de uma serie com poucos metadados (ex.: `Serie Teste Cinco`, seedada deliberadamente "vazia" para validar esse caminho).

### Descoberta (Fase 8) — `lib/discovery/search.ts`

Novos filtros em `SeriesDiscoveryParams`, mesma forma dos existentes (`{ has: valor }` sobre a coluna array): `tag` (Collection Tag), `provider` (streaming), `country` (pais de origem), `language` (idioma, comparacao exata case-insensitive), `keyword` (TMDb). Mais um novo `sort=quality` (ordena por `qualityScore`, usado pelo Hero e disponivel no seletor de ordenacao do catalogo). `getCatalogFilterMetadata()` passou a agregar `tags`/`providers`/`countries`/`languages` (mesma consulta unica + reduce em memoria ja usada para `genres`, sem N+1). O formulario de filtros (`components/series/filters.tsx`) ganhou selects para Tag/Provedor/Pais/Idioma — cada um só aparece se o catalogo tiver pelo menos um valor para aquela faceta (nunca um select vazio). Os cards de tag/keyword da pagina da serie e das secoes da Landing linkam direto para esses filtros (`/series?tag=...`, `/series?keyword=...`).

### Recomendacoes Visuais (Fase 9) — `components/recommendations/recommendation-card.tsx`

O card de recomendacao ganhou o badge de Quality Score, a tag de maior prioridade e os providers — usando os mesmos campos que `CandidateSeries` passou a carregar (plumbing acima). **`lib/recommendations/scoring.ts` e `engine.ts` nao foram alterados**: o algoritmo de ranking continua exatamente o mesmo, so a apresentacao visual mudou.

### Busca Enriquecida (Fase 10)

A "busca" do inSeries e o proprio catalogo filtravel (`/series?q=...`, via `Filters`/`SeriesCard`) — nao existe uma tela de busca separada. Por isso, enriquecer a busca e enriquecer `SeriesCard`: além das Collection Tags/Providers (Fase 4/5), o card do catalogo ganhou o badge de Quality Score ao lado da nota (mesmo tratamento do card de recomendacao) — Status, Tipo e Ano já apareciam (status como badge, ano+plataforma como legenda); Tipo agora tambem aparece na pagina da serie (Fase 7).

### Performance (Fase 12)

- **Sem N+1**: toda consulta nova (Smart Lists da Landing, facetas de filtro, filtros de descoberta) e uma consulta bounded por `take`/`select`, nunca uma consulta por item exibido
- **Sem join desnecessario**: `fetchSmartList` (smart-lists.ts) parou de incluir temporadas/episodios — nenhum carrossel precisa disso; reaproveita o mesmo mapper "so campos de card" que a busca do catalogo ja usava (`toSeriesSummary`, agora exportado e compartilhado entre `lib/discovery/search.ts` e `lib/catalog/smart-lists.ts`)
- **Cache do pipeline preservado**: nenhuma linha de `lib/catalog/sync.ts`, `aggregator.ts`, `curation.ts`, `update-policy.ts` ou `sync-cache.ts` foi tocada nesta sprint — o cache de sincronizacao e o rate limiter continuam exatamente como estavam
- **Lazy loading mantido**: os novos badges/listas sao HTML/CSS puro (sem imagem adicional) exceto o logo (Fase 6), que usa `next/image` sem `priority` (carrega normalmente, sem competir pelo LCP com o backdrop do Hero, que mantem sua `priority`)

### Variaveis de ambiente

Nenhuma nova — esta sprint e inteiramente sobre reutilizar dados e configuracao ja existentes (`config.catalogQuality.tags.minisserieMaxEpisodes`, reaproveitado como limiar da lista "Curtas").

### Decisao documentada: por que providers nao usam logos oficiais

O TMDb retorna, para cada provedor, tanto o nome quanto um `logo_path`. O pipeline de sync (sprint QUALITY-01) so persiste o nome (`Series.watchProviders: String[]`) — capturar o `logo_path` exigiria alterar `lib/tmdb/normalize.ts`/o payload de sync, e essa sprint proibe explicitamente alterar a sincronizacao TMDb ("Não alterar sincronização TMDb", "Não alterar pipeline"). A alternativa seria hotlinkar `image.tmdb.org` a partir de um mapa estatico de nome→path mantido a mao no frontend — fragil (quebra silenciosamente se a TMDb trocar um path) e fora do espirito de "reutilizar exclusivamente os dados ja sincronizados". Por isso, `ProviderBadge` usa uma cor de marca + inicial (`lib/catalog/provider-labels.ts`) — reconhecivel, mas nao um logo oficial pixel-a-pixel.

### Limitacoes atuais

- Providers aparecem como badge colorido com inicial, nao o logo oficial da marca (ver decisao acima)
- `keyword` nao tem um seletor dedicado no formulario de filtros (so via link direto `/series?keyword=...`, a partir da pagina da serie) — adicionar um input de texto livre para keyword no formulario e um proximo passo natural, nao feito aqui para nao inflar ainda mais o formulario de filtros
- Watch Next (`components/watch-next/watch-next-card.tsx`) usa um tipo de serie proprio, minimo, desacoplado de `Series` — nao foi estendido nesta sprint (fora do que o ticket pede explicitamente: Landing/Catalogo/Pagina da Serie/Cards/Busca/Recomendacoes/Descoberta)
- O piso minimo de Quality Score do Hero (`HERO_MIN_QUALITY_SCORE = 55`) e uma constante documentada, nao uma variavel de ambiente — julgamento de escopo (ticket nao pede "tudo configuravel por env" desta vez, ao contrario da sprint QUALITY-01)
- Sandbox sem acesso de rede real ao TMDb (como toda sprint anterior): a validacao usa `seed-dev.ts`, agora computando `qualityScore`/`collectionTags` com as mesmas funcoes reais do pipeline (`computeQualityScore`/`deriveCollectionTags`) em vez de numeros inventados — garante que a demonstracao local é honesta com a formula real, mas o caminho end-to-end com dados reais do TMDb nao pode ser validado aqui
- Nenhuma regra de negocio, autenticacao, sincronizacao, pipeline, permissao ou schema foi alterada — a sprint e estritamente sobre conectar dados ja existentes a interface

## Landing cinematografica (INSERIES-LANDING-CINEMATIC-IMMERSION-01)

A sprint anterior conectou os metadados enriquecidos (Quality Score, Collection Tags, Providers, logos) a interface. Esta sprint transforma a **experiencia visual** da Landing publica em torno desses mesmos dados — sem video, sem autoplay, usando exclusivamente imagens reais (backdrop/poster/logo) ja sincronizadas do TMDb. Nenhuma regra de negocio, autenticacao, fluxo de cadastro, schema ou permissao foi alterada.

### Auditoria visual (Fase 1) — o que a Landing anterior tinha

- Hero era um card com bordas arredondadas e container centralizado (`-mx-4 sm:mx-0 sm:rounded-4xl sm:border`), nunca full-bleed, sempre fixo na serie mais popular (sem rotacao)
- Header era um Server Component estatico, sem overlay, sem transparencia, sem reacao a scroll — so mais um bloco no topo da pagina
- 10 carrosseis em sequencia direta, todos com o mesmo layout de card — "Hero, Cards, Cards, Cards, Cards..." sem ritmo, sem banners, sem grid intercalado
- Estatisticas do catalogo apareciam logo abaixo do Hero como 4 caixas com borda — a primeira coisa que o visitante via depois do Hero era, na pratica, um widget de admin/dashboard
- Quase todo o uso de imagem era poster (retrato); backdrop so aparecia no Hero e no header da pagina da serie

### Hero Full Screen e Dinamico (Fase 2/3/4) — `components/landing/cinematic-hero.tsx`

O Hero agora ocupa `min-h-[95dvh]` no mobile e `100dvh` no desktop, **full-bleed** (100vw, sem bordas, sem container centralizado) — a mesma tecnica de qualquer plataforma de streaming. Tecnicamente: a Landing quebra o container `max-w-7xl` do `LandingShell` com `relative left-1/2 right-1/2 -mx-[50vw] w-screen` (uma tecnica CSS padrao de "full-bleed a partir de um container limitado", contida por `overflow-x-clip` no shell para nunca criar scroll horizontal).

`CinematicHero` (Client Component) rotaciona automaticamente a cada 18s (dentro da janela de 15-20s pedida) entre um pool de series de alta qualidade (mesmo criterio de Quality Score da sprint anterior — `HERO_MIN_QUALITY_SCORE`), **embaralhado no servidor a cada request/reload** (`Math.random()`, nunca no cliente — sem esse cuidado haveria mismatch de hidratacao entre o HTML do servidor e o primeiro render do cliente). Isso satisfaz os dois requisitos ao mesmo tempo: o pool nunca repete uma serie dentro de si mesmo, e cada atualizacao de pagina mostra uma ordem/serie inicial diferente.

- **Sem flickering**: apenas duas camadas de backdrop existem no DOM a qualquer momento — a ativa (`opacity-100`) e a proxima (`opacity-0`, invisivel mas ja carregando — "preload da proxima imagem"). Quando o timer avança, a camada que era "proxima" so troca de classe (mesmo `key`, React reconcilia no lugar em vez de remontar), e uma nova "proxima" e montada por tras
- **Pausa no hover**: `onMouseEnter`/`onMouseLeave` no container inteiro pausam o `setInterval`
- **Indicador de rotacao**: pontos clicaveis (`role="tablist"`) permitem navegacao manual, sempre visiveis (nao escondidos atras de hover — funcionam em touch tambem)
- **Parallax leve**: a camada de backdrop ativa recebe um zoom lento (`animate-kenburns`, 20s, `scale(1)` -> `scale(1.08)`) — puramente decorativo, respeita `prefers-reduced-motion` (ja tratado globalmente em `app/globals.css`)

### Destaque Premium (Fase 4) — o que o Hero mostra por serie

Para a serie em rotacao: status, tipo (categoria — `type`, ex. "Miniseries"), ano, nota, Quality Score, generos, sinopse, Collection Tags e providers (reaproveitando os componentes da sprint anterior), alem do logo oficial no lugar do titulo em texto quando existe (`SeriesLogoOrTitle`, sprint anterior — nunca duplicado). O logo/marca do proprio inSeries nao aparece mais dentro do Hero: como o header fixo ja mostra a marca sobreposta em todas as paginas, repeti-la dentro do Hero seria informacao duplicada.

### Navegacao Transparente (Fase 5) — `components/layout/landing-header.tsx`

O header publico virou Client Component: `fixed inset-x-0 top-0 z-50`, transparente por padrao, com `useEffect` + listener de scroll (`passive: true`) que aplica um fundo solido (`bg-canvas/85 backdrop-blur-md border-b`) apos 60px de scroll, com `transition-colors duration-300` para a troca ser suave, nunca abrupta. Por ser `fixed` (removido do fluxo normal), `LandingShell` foi ajustado para compensar: o antigo `pt-4` virou `pt-24`, garantindo que toda pagina publica que **nao** e a Landing (login, registro, catalogo, pagina da serie) continue com espaco correto abaixo do header fixo — so a Landing cancela esse `pt-24` com `-mt-24` no wrapper do Hero, reclamando o viewport inteiro.

### Ritmo Visual (Fase 6) — nova sequencia da Landing

A sequencia deixou de ser "Hero, Cards x10" e passou a alternar: Hero → Carrossel → Banner cinematografico → Carrosseis → Banner → Carrosseis → Banner → **Grid de Colecoes** → Banner → Estatisticas (discretas) → Beneficios/Recursos/Depoimentos/FAQ → CTA final. Nem toda lista inteligente virou um carrossel dedicado — para a Landing "respirar", cinco delas (Minisseries, Curtas, Baseadas em Livros, Premiadas, Longa Duracao) foram consolidadas na grade de Colecoes Editoriais (Fase 10) em vez de mais cinco carrosseis identicos.

### Banners Cinematograficos (Fase 7) — `components/landing/cinematic-banner.tsx`

Quatro banners horizontais entre os carrosseis, cada um com um backdrop real de fundo e linkando direto para a serie: **Serie da Semana** (mais popular), **Mais Comentada** (mais votos — `listMaisComentadas`, sprint anterior, nunca usada na UI ate agora), **Vale a Maratona** (de `listMaratonas`) e **Escolha da Comunidade** (de `listPremiadas`/`listMaisBemAvaliadas`). Cada banner deliberadamente escolhe uma serie diferente dos outros banners/do Hero quando possivel (`.find` com exclusao por id), para nao repetir a mesma capa varias vezes seguidas.

### Carrosseis Diferenciados (Fase 8) — `SeriesPosterCard` ganhou `variant`

| Carrossel | Variant | O que muda |
|---|---|---|
| Em Alta | `large` (via `CarouselItem size="large"`) | Poster maior (`w-48 sm:w-56 lg:w-64` em vez de `w-40 sm:w-44 lg:w-48`) |
| Mais Bem Avaliadas | `rating` | Nota em destaque (badge maior, centralizado) |
| Novidades | `new` | Badge "NOVO" |
| Maratonas | `episodes` | Temporadas/episodios no hover |
| Em Exibicao | `status` | Badge de status sempre visivel (nao so no hover) |
| Finalizadas | `collection` | Badge "Colecao completa" |
| Mais Populares (demais) | `default` | Comportamento original |

`CarouselItem` ganhou uma prop `size` dedicada (`"default" | "large"`) em vez de aceitar uma classe de largura arbitraria via `className` — evita que duas classes `w-*` conflitantes (a padrao do componente + uma sobrescrita) coexistam no DOM sem uma resolucao previsivel (o util `cn()` deste projeto e so `clsx`, sem dedupe de utilitarios Tailwind conflitantes).

### Cards Premium (Fase 9)

Hover mais sofisticado em toda `SeriesPosterCard`/`SeriesCard`: gradiente mais forte, escala da imagem maior (`scale-110` em vez de `scale-105`), elevacao (`-translate-y-1.5`), generos revelados no hover (informacao extra sem poluir em repouso), tudo com timing mais lento/suave (`duration-300`/`duration-500`).

### Colecoes Editoriais (Fase 10) — grid, nao mais carrosseis

Dez tiles (`grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5`), cada um um backdrop real + titulo, linkando para um filtro de descoberta **ja existente** — nenhuma regra nova:

- 5 via Collection Tags ja existentes: Minisseries, Series Curtas, Indicadas ao Emmy (reaproveita a tag "Premiada" — TMDb nao expoe premios reais, mesma decisao documentada na sprint QUALITY-01), Baseadas em Livros, Longa Duracao
- 5 via genero (`searchSeries({ genre })`, mecanismo ja existente desde a sprint anterior): Sci-Fi, Drama, Suspense, Fantasia, Animacoes

Cada tile so aparece se houver pelo menos uma serie correspondente no catalogo (nunca uma colecao vazia).

### Uso Intensivo de Backdrops (Fase 11)

Backdrop passou a ser a imagem dominante da Landing: Hero (rotativo), os 4 banners cinematograficos e os 10 tiles de colecoes usam backdrop — o poster continua reservado aos carrosseis (onde o formato retrato faz mais sentido para "folhear" varias series). O total de `<img>` de backdrop na Landing saltou de 1 (so o Hero) para dezenas por carregamento de pagina.

### Remocao do Aspecto Administrativo (Fase 12)

O bloco de estatisticas (series/episodios/usuarios/reviews) saiu da primeira dobra (logo abaixo do Hero) e foi reposicionado logo antes da secao "Por que inSeries", bem mais abaixo na pagina. Alem de mudar de lugar, mudou de forma: as 4 caixas com borda (`rounded-3xl border ... p-4`, visual de widget/dashboard) viraram uma faixa inline discreta (`flex flex-wrap justify-center gap-x-10 border-y border-border/60 py-8 text-center`) — os numeros continuam la (nada foi removido), mas nao competem mais com o catalogo pela atencao do visitante na primeira dobra.

### Microinteracoes (Fase 13) — `components/media/scroll-reveal.tsx`

`ScrollReveal` envolve cada secao abaixo do Hero (carrosseis, banners, colecoes, beneficios, recursos, depoimentos, FAQ, CTA final) com um `IntersectionObserver`: a secao nasce com `opacity-0 translate-y-4` e anima para `opacity-100 translate-y-0` (reaproveitando o mesmo timing de transicao do resto do design system) na primeira vez que entra no viewport — nunca de novo depois disso (o observer se desconecta apos revelar). O conteudo sempre existe no HTML enviado pelo servidor (nada e escondido de crawlers/no-JS); so a animacao de entrada e progressiva. `prefers-reduced-motion` ja colapsa toda transicao globalmente, entao a acessibilidade vem de graca.

### Mobile Premium (Fase 14)

- Hero usa `min-h-[95dvh]` (unidade de viewport dinamica, ajusta a altura real disponivel descontando a barra de endereco do navegador movel — mais confiavel que `vh` puro em iOS/Android)
- Header fixo mantem `safe-pt` (`env(safe-area-inset-top)`) para nao colidir com notch/ilha dinamica
- Carrossel ja era touch-friendly (scroll nativo com `snap-x snap-mandatory`, sprint anterior) — sem mudanca necessaria
- Tipografia do Hero escala de `text-4xl` (mobile) ate `text-7xl` (desktop) via classes responsivas

### Performance (Fase 15)

- **Shimmer/blur placeholder**: `PosterImage`/`BackdropImage` agora mostram um `skeleton-shimmer` (reaproveita a mesma animacao dos componentes `Skeleton*` existentes) atras da imagem ate o evento `onLoad` disparar, com fade-in de opacidade (`transition-opacity duration-500`) na propria imagem — nunca mais um "pop-in" abrupto. O fade fica num wrapper `<div>` proprio (nao misturado a `imageClassName`) para nunca competir com uma transicao de hover/zoom que o consumidor do componente ja tenha (ex.: `group-hover:scale-110`) — duas classes `transition-*` conflitantes no mesmo elemento tem resolucao imprevisivel sem `tailwind-merge`
- **`priority` so acima da dobra**: a primeira imagem do Hero (`index === 0`) e os 4 primeiros posteres do primeiro carrossel continuam com `priority`; todo o resto (banners, colecoes, carrosseis seguintes) carrega sob demanda (comportamento padrao do `next/image`, nunca forcado a eager)
- **Sem N+1 novo**: os 4 banners e 10 tiles de colecao reaproveitam arrays ja buscados (`maisPopulares[0]`, `maratonas[0]`, etc.) ou usam consultas ja bounded por `pageSize`/`take` (as 5 buscas por genero para os tiles, `pageSize: 1` cada) — nenhuma consulta proporcional ao tamanho do catalogo
- **Bundle**: `/` (Landing) foi de um Server Component quase sem JS proprio para ~4.9kB de JS de rota (Hero rotativo + header com scroll listener + scroll-reveal) — o First Load JS total (`~120kB`) permanece na mesma faixa das paginas mais pesadas ja existentes no app (ex. `/series/[id]`), sem build warnings novos

### Decisoes arquiteturais

- **Full-bleed via CSS, nao via restruturacao do shell**: a tecnica `left-1/2 -mx-[50vw] w-screen` fica isolada no wrapper do Hero dentro da propria Landing — `LandingShell`/`LandingHeader` só receberam o ajuste minimo necessario (header fixo + `pt-24` de compensacao), sem redesenhar o shell publico inteiro, minimizando o raio de impacto em login/registro/catalogo
- **Embaralhar no servidor, nunca no cliente**: qualquer `Math.random()` de selecao do pool do Hero acontece durante o render do servidor (React Server Component), nunca dentro do Client Component `CinematicHero` — evita mismatch de hidratacao (o HTML que o servidor manda e exatamente o que o cliente hidrata; so a *rotacao ao longo do tempo* e client-side, via `setInterval`)
- **Consolidar 5 listas na grade de Colecoes em vez de 5 carrosseis a mais**: julgamento de design para o "ritmo respirar" pedido pelo ticket — nenhuma lista foi removida da navegacao (todas continuam acessiveis via seus links), so deixaram de ser um carrossel de topo de pagina

### Bug encontrado e corrigido durante esta sprint

Ao mover a largura variavel do carrossel "Em Alta" (`large`) de uma classe Tailwind sobrescrita via `className` para uma prop dedicada em `CarouselItem`, percebi que o padrao anterior (`cn("w-40 shrink-0 snap-start sm:w-44 lg:w-48", className)`, ja em uso desde a sprint COVERAGE-01) sempre teve um risco latente: como `cn()` neste projeto e so `clsx` (sem dedupe de utilitarios Tailwind conflitantes), duas classes `w-*` poderiam coexistir no DOM com resolucao de CSS imprevisivel. Nao chegou a quebrar nada ate agora porque nenhum caller anterior tentava sobrescrever a largura — mas ao precisar disso pela primeira vez nesta sprint, troquei para uma prop `size` dedicada (larguras sempre mutuamente exclusivas) em vez de arriscar o padrao antigo. Mesmo problema de fundo tambem existia em `PosterImage`/`BackdropImage` (uma nova classe de fade-in por opacidade que eu ia adicionar quase colidiu com as transicoes de hover/zoom que os consumidores ja passam via `imageClassName`) — resolvido isolando o fade num `<div>` wrapper proprio, nunca misturado a `imageClassName`.

### Limitacoes atuais

- Sem Lighthouse/CI automatizado neste sandbox para medir Web Vitals numericamente — a validacao de performance foi por inspecao (bundle size no build, contagem de imagens com `priority`, ausencia de novas queries por item) e pelo smoke test, nao por um relatorio Lighthouse real
- O piso de qualidade do Hero, o intervalo de rotacao (18s) e os limiares de "Colecao Curtas"/"Emmy" (reaproveitando "Premiada") sao constantes documentadas no codigo, nao variaveis de ambiente — julgamento de escopo (este ticket nao pede configuracao por env)
- Sandbox sem acesso de rede real ao TMDb (como toda sprint anterior) — a validacao usa o catalogo local (`seed-dev.ts`) com Quality Score/Collection Tags calculados pelas funcoes reais do pipeline; o comportamento com o catalogo real de producao (milhares de series, mais diversidade de generos/tags) nao foi validado aqui
- Nenhuma regra de negocio, autenticacao, fluxo de cadastro, sincronizacao TMDb, permissao ou schema foi alterada — a sprint e estritamente visual/experiencia sobre a Landing publica

## Discovery Engine — descoberta editorial inteligente (INSERIES-TRENDING-DISCOVERY-ENGINE-01)

Sprint focada em resolver um problema concreto: o catalogo importava qualquer serie que
passasse por filtros fracos (ou nenhum filtro), fazendo com que series obscuras, com poucos
votos ou irrelevantes competissem por espaco no mesmo nivel de titulos como The Last of Us
ou Severance. Esta sprint nao adiciona mais fontes de importacao — adiciona um motor que
**ranqueia e filtra** o que ja era coletado, decidindo o que realmente entra na fila e o
quanto cada serie deve ser destacada. Nenhuma regra de negocio, autenticacao, usuario, lista,
progresso ou pipeline existente foi alterada — toda a implementacao e aditiva.

### Fase 1 — Auditoria do mecanismo de ranking atual

Antes de qualquer codigo, o pipeline existente (`lib/catalog/aggregator.ts`,
`lib/catalog/sync.ts`, `lib/catalog/curation.ts`, `lib/config/index.ts`) foi auditado:

- **Por que series desconhecidas continuavam entrando**: `TMDB_MIN_VOTE_COUNT` (filtro de
  qualidade do pipeline de descoberta) tem default **0** (desligado). `TMDB_MIN_VOTE_AVERAGE`
  (usado pela curadoria automatica, `lib/catalog/curation.ts`) tambem tem default **0**
  (desligado). A curadoria automatica so bloqueia series sem poster/backdrop/overview,
  pilotos abandonados ha muito tempo ou com zero episodios — uma serie completa,
  bem-formada, mas com 5 votos e nota irrelevante **passa por todos os filtros existentes**.
- **Peso da popularidade**: `priorityScore` (`lib/catalog/aggregator.ts`) usa
  `popularity * 1 + vote_count * 0.01 + vote_average * 5`, mais bonus de +20 se a serie
  aparece em On The Air/Airing Today e +10 se aparece em Airing Today. Esse score, no
  entanto, **so decide a ordem de processamento da fila** dentro de `syncCoverage` — nao
  decide se a serie entra ou nao. Toda serie que passa pelo filtro fraco de qualidade acima
  e importada, nao importa o quao baixo seja seu `priorityScore`.
- **Peso do Trending**: nenhum. `TRENDING` era so mais uma das 6 fontes agregadas
  igualmente por `collectCandidates` — nao contribuia sequer para os bonus de
  `priorityScore` (so On The Air/Airing Today contribuiam). Uma serie realmente "bombando"
  no TMDb Trending nao tinha nenhuma vantagem sobre uma serie obscura encontrada via
  Discover.
- **Peso dos Providers**: nenhum no ranking. Presenca de streaming providers so influenciava
  o Quality Score editorial (`lib/catalog/quality-score.ts`, peso 0.75 de 14 sinais) — nunca
  a decisao de quais series priorizar ou destacar.
- **Peso do Discover**: o Discover ordena por `popularity.desc`, mas e a fonte com maior
  superficie de catalogo (qualquer genero/status/idioma) sem nenhum filtro de relevancia
  proprio alem dos filtros globais fracos acima — contribuia com o maior volume de series
  de cauda longa.
- **Conclusao da auditoria**: o catalogo nunca teve um mecanismo dedicado de **descoberta**
  (o que e relevante agora) separado do mecanismo de **qualidade editorial** (o quao completo
  e o metadado). Faltava (a) pesos por fonte, (b) um score proprio para relevancia de
  descoberta, (c) prioridade real para streamings populares no ranking, e (d) uma blacklist
  com defaults efetivamente restritivos.

### Fase 2 — Discovery Engine (`lib/discovery/engine.ts`)

Um motor unico e novo (nao substitui `syncCoverage`/`syncPopularSeries`/etc., que continuam
existindo e funcionando exatamente como antes) responsavel por decidir **quais series entram
na fila** e em que ordem:

1. Coleta candidatos via `TmdbDiscoveryProvider` (`lib/discovery/providers/tmdb-provider.ts`),
   que expõe 5 fontes ponderadas — reaproveita `collectCandidates`
   (`lib/catalog/aggregator.ts`, inalterado) e o `SyncCache`/rate limiter existentes.
2. Filtra pela blacklist em nivel de item de lista (`passesListItemBlacklist`, Fase 5).
3. Calcula o `sourceWeightScore` de cada candidato (`computeSourceWeightScore`,
   `lib/discovery/source-weight.ts`) — soma normalizada (0-1) dos pesos das fontes que
   encontraram aquela serie.
4. Reordena a fila por `sourceWeightScore` (desempate pelo `priorityScore` ja existente).
5. Processa apenas o **top N** (`config.discoveryEngine.maxCandidatesPerRun`, default 100) —
   "o objetivo nao e importar mais series, e importar as series certas".
6. Para cada candidato processado: busca detalhes completos (reaproveita
   `fetchFullSeriesFromTmdb`, exportado de `lib/catalog/sync.ts` sem nenhuma alteracao de
   comportamento), aplica a blacklist em nivel de detalhe (Fase 5), faz upsert (reaproveita
   `upsertNormalizedSeriesWithCounts`, `lib/catalog/repository.ts`, tambem inalterado) e
   persiste o Discovery Score (Fase 3) numa chamada `update` dedicada e isolada — nunca
   dentro do upsert compartilhado, para o pipeline antigo continuar 100% intacto.

Pesos por fonte (Fase 2, `config.discoveryEngine.sourceWeights`, normalizados entre si):

| Fonte | Peso padrao | Env var |
|---|---|---|
| Trending | 0.40 | `DISCOVERY_SOURCE_WEIGHT_TRENDING` |
| On The Air | 0.25 | `DISCOVERY_SOURCE_WEIGHT_ON_THE_AIR` |
| Popular | 0.15 | `DISCOVERY_SOURCE_WEIGHT_POPULAR` |
| Top Rated | 0.10 | `DISCOVERY_SOURCE_WEIGHT_TOP_RATED` |
| Discover | 0.10 | `DISCOVERY_SOURCE_WEIGHT_DISCOVER` |

### Fase 3 — Premium Discovery Score (`lib/discovery/discovery-score.ts`)

Um score 0-100 novo e persistido (`Series.discoveryScore`), distinto do `qualityScore`
(mede completude editorial). O Discovery Score mede **relevancia de descoberta agora**:
soma ponderada normalizada (mesmo formato do Quality Score) de: trending (sourceWeightScore),
popularidade, vote_average, vote_count, recencia, status, presenca em streaming prioritario
(Fase 4), temporadas, episodios, presenca de backdrop/poster, quantidade de Collection Tags
e o proprio Quality Score (como mais um sinal, nunca reaproveitado sozinho — pedido explicito
do ticket). Pesos em `config.discoveryEngine.scoreWeights`, todos configuraveis via env
(`DISCOVERY_SCORE_WEIGHT_*`). `discoveryScore` fica `null` para series nunca processadas pelo
Discovery Engine (ex.: catalogo seedado localmente antes da primeira execucao).

### Fase 4 — Streamings prioritarios

`config.discoveryEngine.streamingPriorityList` (env `DISCOVERY_STREAMING_PRIORITY_LIST`,
lista separada por virgulas) define quais streamings dao bonus no Discovery Score:
Netflix, Max, Prime Video, Disney+, Apple TV+, Paramount+, Hulu, Peacock, Crunchyroll,
Globoplay (default). `computeStreamingPriorityScore` (`lib/discovery/source-weight.ts`)
retorna 1 se a serie estiver disponivel em qualquer streaming da lista, 0 caso contrario —
alimenta o sinal `providers` do Discovery Score.

### Fase 5 — Blacklist inteligente (`lib/discovery/blacklist.ts`)

Filtros dedicados e config-driven do proprio Discovery Engine, deliberadamente separados de
`lib/catalog/curation.ts` (que continua gating `syncPopularSeries`/`syncCoverage`/etc. do
jeito que sempre gatingou — "nao alterar pipeline ja existente"). Defaults desta blacklist
sao propositalmente restritivos (diferente dos defaults de `catalogQuality.curation`, que sao
0/desligados) — e o ponto central desta sprint:

| Filtro | Default | Env var |
|---|---|---|
| Habilitado | `true` | `DISCOVERY_BLACKLIST_ENABLED` |
| Votos minimos | 100 | `DISCOVERY_BLACKLIST_MIN_VOTE_COUNT` |
| Nota minima | 5.5 | `DISCOVERY_BLACKLIST_MIN_VOTE_AVERAGE` |
| Exige poster | `true` | `DISCOVERY_BLACKLIST_REQUIRE_POSTER` |
| Exige backdrop | `true` | `DISCOVERY_BLACKLIST_REQUIRE_BACKDROP` |
| Exige overview | `true` | `DISCOVERY_BLACKLIST_REQUIRE_OVERVIEW` |
| Exige episodios | `true` | `DISCOVERY_BLACKLIST_REQUIRE_EPISODES` |
| Idade maxima de piloto abandonado | 365 dias | `DISCOVERY_BLACKLIST_MAX_PILOT_AGE_DAYS` |

Dois niveis, mesmo formato de `curation.ts`: `passesListItemBlacklist` (campos baratos do
item de lista, antes de qualquer fetch completo) e `passesDetailBlacklist` (serie normalizada
completa, antes do upsert).

### Fase 6 — Trending Collections (`lib/catalog/smart-lists.ts`)

Novas listas editoriais, todas derivadas de `discoveryScore` (nunca de popularidade bruta
diretamente):

| Lista | Funcao | Criterio |
|---|---|---|
| Bombando Agora | `listBombandoAgora` | `discoveryScore` desc |
| Mais Assistidas | `listMaisAssistidas` | popularidade desc, entre as com Discovery Score >= 40 |
| Mais Comentadas | `listMaisComentadas` (reaproveitada) | vote_count desc |
| Em Alta nos Streamings | `listEmAltaNosStreamings` | streaming prioritario + `discoveryScore` desc |
| Lancamentos | `listLancamentos` | ultimo ano + `discoveryScore` desc |
| Premiadas | `listPremiadas` (reaproveitada) | tag "Premiada" |
| Imperdiveis | `listImperdiveis` | `discoveryScore` >= 70 **e** `qualityScore` >= 70 |
| Maratonas | `listMaratonas` (reaproveitada) | tag "Maratona" |
| Top 100 / Top 250 | `listTop100` / `listTop250` | `discoveryScore` desc, limite 100/250 |

`LANCAMENTOS` usa uma janela relativa ao ano atual (`where` como funcao, avaliada a cada
chamada — nunca congelada no carregamento do modulo).

### Fase 7 — Atualizacao frequente, sem reprocessar o catalogo inteiro

`npm run discovery:run` (`scripts/discovery-run.ts`) roda **so** o Discovery Engine —
nao entra em `syncFullCatalog`/`syncCoverage`. Pensado para rodar diariamente (cron externo)
sem reprocessar o catalogo inteiro: o `maxCandidatesPerRun` (default 100) mantem cada
execucao bounded, e a blacklist/ranking evitam refazer trabalho em series irrelevantes.
Tambem disponivel no workspace admin (`/admin/sync`, botao "Rodar Discovery Engine") via
`POST /api/admin/sync/discovery`.

### Fase 8 — Preparacao para Trakt (sem implementar Trakt)

`lib/discovery/providers/types.ts` define a interface `DiscoveryProvider`
(`buildWeightedSources`) que qualquer backend de descoberta deve satisfazer.
`TmdbDiscoveryProvider` (`lib/discovery/providers/tmdb-provider.ts`) e a unica
implementacao desta sprint. Um futuro `TraktDiscoveryProvider` buscaria das listas
trending/popular/anticipated do Trakt, normalizaria para o mesmo formato de candidato
(`TmdbListSeriesItem`-like) e se conectaria aqui sem o Discovery Engine
(`lib/discovery/engine.ts`) mudar nada — `runDiscoveryEngine({ provider })` ja aceita
qualquer implementacao da interface. Nenhuma integracao real com Trakt foi feita, como
pedido explicitamente pelo ticket.

### Fase 9 — Dashboard: "🔥 Bombando Agora"

Novo card em `components/dashboard/dashboard-home.tsx`, alimentado exclusivamente por
`listBombandoAgora` (Discovery Score) — nunca por `listMaisPopulares` ou qualquer lista de
popularidade bruta. Link "Ver tudo" leva a `/series?sort=discovery` (novo `SeriesSortOption`
em `lib/discovery/search.ts`, aditivo).

### Fase 10 — Landing: Hero usa Discovery Score

`lib/catalog/hero-selection.ts`: `pickHero` agora prioriza `discoveryScore` (bar
`HERO_MIN_DISCOVERY_SCORE = 55`) em vez de `qualityScore`. Fallback em dois niveis: se
nenhuma serie do pool tem `discoveryScore` (Discovery Engine nunca rodou), cai para o
criterio antigo de `qualityScore`; se nenhuma qualifica por nenhum dos dois, cai para
popularidade pura — o Hero nunca fica vazio. `components/landing/landing-page.tsx` busca o
pool via `searchSeries({ sort: "discovery", ... })` e so usa esse pool se pelo menos 4
series realmente cruzarem a barra do Discovery Score; caso contrario usa o fallback de
popularidade inteiro (nunca mistura series abaixo da barra so para completar 4).

### Fase 11 — Observabilidade

`runDiscoveryEngine` retorna e persiste em `CatalogSyncRun.metadata.observability`:
quantidade de candidatos coletados/ranqueados, quantos foram descartados e por qual motivo
(`discardReasons`, um mapa motivo→contagem), quantos ficaram de fora so por ranking
(`skippedByRankCount`), Discovery Score medio e Trending Score medio dos processados,
quantas series tinham providers encontrados, e as chamadas TMDb/retries/rate-limit-hits do
run. `scripts/_shared/print-discovery-report.ts` imprime tudo isso no CLI (`discovery:run`),
incluindo um snapshot de `computeCatalogStatistics()` (top status/streamings/categorias/
paises/idiomas) — reaproveitado sem alteracao. Como toda `CatalogSyncRun`, aparece
automaticamente em `/admin/sync` e em `npm run sync:stats` (ambos genericos por `type`, sem
qualquer alteracao de codigo).

### Fase 12 — Performance preservada

Nenhum arquivo do pipeline existente foi reescrito. `lib/catalog/sync.ts` teve apenas uma
palavra `export` adicionada (para reaproveitar `fetchFullSeriesFromTmdb` sem duplicar
logica) — zero mudanca de comportamento. `lib/catalog/aggregator.ts`, `curation.ts`,
`update-policy.ts`, `sync-cache.ts` e `quality-score.ts` nao foram tocados. O Discovery
Engine reaproveita o mesmo `SyncCache`/rate limiter/retry — nenhum mecanismo novo de rede.
O update de `discoveryScore` e uma chamada extra por serie processada, sempre limitada por
`maxCandidatesPerRun` (nunca proporcional ao tamanho do catalogo) — sem N+1.

### Decisoes arquiteturais

- **Discovery Score nunca substitui Quality Score.** Sao dois scores 0-100 persistidos
  separadamente, com formulas e pesos distintos, medindo coisas diferentes (relevancia de
  descoberta vs. completude editorial). O ticket foi explicito: "Nao reutilizar apenas o
  Quality Score."
- **Blacklist do Discovery Engine e separada da curadoria existente** (`curation.ts`).
  A curadoria continua gating a importacao no pipeline antigo exatamente como antes; a
  blacklist so afeta o que o Discovery Engine processa/destaca. Isso significa que uma
  serie pode existir no catalogo (importada pelo `sync:coverage` antigo) sem nunca aparecer
  em Bombando Agora/Hero/Top 100 se nunca passar pelo Discovery Engine ou nao atingir a
  blacklist dele.
- **`discoveryScore` persistido via `update` isolado, nunca dentro do upsert
  compartilhado** (`upsertNormalizedSeriesWithCounts`). Preserva 100% o comportamento do
  pipeline antigo (que nunca soube de `discoveryScore`) e mantem o "blast radius" da mudanca
  restrito ao codigo novo.
- **`maxCandidatesPerRun` (default 100) e o mecanismo central que resolve "importar as
  series certas, nao mais series".** Sem esse cap, ranquear e filtrar nao teriam efeito
  pratico sobre volume.
- **Seed local (`seed:dev`) passou a computar `discoveryScore` com a formula real**
  (`computeDiscoveryScore`), usando um `sourceWeightScore` hipotetico por serie fixa (nunca
  um `discoveryScore` inventado a dedo) — mesma disciplina ja usada para `qualityScore`/
  `collectionTags` desde a sprint QUALITY-01, necessaria porque este sandbox nao tem acesso
  de rede ao TMDb para rodar o Discovery Engine de verdade.

### Limitacoes atuais

- Sem acesso de rede real ao TMDb neste sandbox, o Discovery Engine nunca rodou contra a
  API real — validado via testes unitarios das funcoes puras (`computeSourceWeightScore`,
  `computeStreamingPriorityScore`, `computeDiscoveryScore`, blacklist) e via o fluxo de
  abort amigavel ("TMDb nao configurado"), no mesmo padrao ja estabelecido para
  `sync:coverage`/`sync:update`.
  - Se quiser rodar em producao com Trakt no futuro, a Fase 8 ja deixou a interface
  `DiscoveryProvider` pronta — falta so implementar `TraktDiscoveryProvider` e passa-lo a
  `runDiscoveryEngine({ provider })`.
- `maxCandidatesPerRun`, os pesos de fonte/score e a lista de streamings prioritarios sao
  constantes/env vars documentadas, nao uma tela de configuracao dinamica no admin.

## Continuar assistindo (INSERIES-CONTINUE-WATCHING-EXPERIENCE-01)

O Dashboard deixa de ser so uma visao geral e ganha uma primeira area dedicada a retomar a
experiencia: "Continuar assistindo", no topo, mostrando as ultimas series acompanhadas e o
proximo episodio de cada uma — como o "continue watching" de qualquer plataforma de
streaming.

### Fase 1 — Auditoria

- **Onde ja e calculado o proximo episodio**: `getWatchNextForUser` (`lib/watch-next/queries.ts`).
  Busca todo `UserSeriesStatus` do usuario em estado `WATCHING`/`WANT_TO_WATCH`, com
  `seasons`/`episodes`/`progress` aninhados numa unica query; para cada serie, filtra
  episodios ja lancados (`airedAt <= now`) e nao assistidos, pega o mais antigo como "next".
  Essa e a **unica** logica de "o que assistir a seguir" no app — usada por `/watch-next`,
  `/me` e `GET /api/me/watch-next`.
- **Como saber a ultima serie assistida**: `UserSeriesStatus.lastActivityAt` — atualizado em
  toda mudanca de status (`upsertSeriesStatus`) e toda marcacao de episodio
  (`toggleEpisodeProgress`, ambos em `lib/progress/mutations.ts`) — **ja existe**, sem
  precisar de tabela ou coluna nova.
- **Se ja existe timestamp de episodio assistido**: sim — `UserEpisodeProgress.watchedAt`,
  preenchido no mesmo `toggleEpisodeProgress`. Tambem ja existente.
- **Se a ordenacao por atividade recente ja pode ser feita sem schema novo**: sim — os dois
  campos acima (`lastActivityAt`, `watchedAt`) mais `UserSeriesStatus.startedAt` e
  `completionPercent` (tambem ja existentes) sao suficientes para toda a Fase 3. **Nenhuma
  migration foi necessaria nesta sprint.**
- **UserSeriesStatus/Episode/Season/Series**: nenhum desses modelos precisou de alteracao —
  `Episode.runtimeMinutes` (duracao), `Season.episodeCount` (total da temporada) e
  `UserSeriesStatus.completionPercent` (progresso da serie, ja recalculado por
  `calculateSeriesProgress` a cada mutation) ja cobrem todo o Fase 2.

### Fase 2 — Servico de Continue Watching (`lib/continue-watching/`)

`getContinueWatchingForUser` (`lib/continue-watching/queries.ts`) **nunca recalcula** qual e
o proximo episodio: chama `getWatchNextForUser` sem limite, e so enriquece o resultado com
campos extras via um numero fixo de queries adicionais, todas em lote (`WHERE ... IN (...)`,
nunca uma por serie/episodio — Fase 9):

1. `series.findMany` → `backdropUrl` de cada serie.
2. `userSeriesStatus.findMany` → `completionPercent` (progresso da serie), `lastActivityAt`,
   `startedAt`.
3. `season.findMany` → `episodeCount` de cada temporada (denominador do progresso da
   temporada).
4. `userEpisodeProgress.findMany` (so `watched: true`, ordenado por `watchedAt desc`) → usada
   para **duas** coisas ao mesmo tempo: o ultimo episodio assistido por serie (primeira
   ocorrencia apos o sort) e a contagem de assistidos por temporada (progresso da temporada).
5. `episode.findMany` pelos ids dos "proximos episodios" → `runtimeMinutes` (duracao).

Tudo isso roda em paralelo (`Promise.all`) e e combinado em memoria com o resultado do Watch
Next — nenhuma segunda passada pelo algoritmo de selecao.

### Fase 3 — Ordenacao

1. Atividade mais recente (`UserSeriesStatus.lastActivityAt` desc).
2. Episodio pendente disponivel — automatico: todo item de `getWatchNextForUser` ja tem um
   episodio pendente por construcao (series sem pendencia nunca entram no resultado).
3. Acompanhada recentemente — desempate por `startedAt` desc.
4. Fallback — ordem original do Watch Next (episodio pendente mais antigo primeiro).

"Nunca mostrar series que o usuario nao acompanha" tambem e automatico: a fonte
(`getWatchNextForUser`) ja filtra por `WATCHING`/`WANT_TO_WATCH`.

### Fase 4/8 — UI no Dashboard

`components/continue-watching/continue-watching-section.tsx` — primeira area do Dashboard
(`components/dashboard/dashboard-home.tsx`), acima do grid de cards existente. Titulo
"Continuar assistindo", subtitulo "Retome suas series exatamente de onde parou." Reaproveita
o shelf `Carousel`/`CarouselItem`
(ja existente desde INSERIES-LANDING-CINEMATIC-IMMERSION-01) — linha horizontal com setas no
desktop, carrossel com scroll-snap nativo no mobile, sem nenhum mecanismo de layout novo.

`components/continue-watching/continue-watching-card.tsx` — poster grande + backdrop
esmaecido revelado no hover, badge "Novo episodio", codigo T/E, duracao, barra de progresso
da serie e da temporada, episodios restantes, ultimo episodio assistido (com data relativa),
e os dois botoes pedidos: "Continuar" (link para `/series/[slug]/episode/[id]`) e "Marcar
como assistido" (reaproveita `WatchNextMarkButton` **sem nenhuma modificacao** — mesmo botao,
mesma mutation, mesmo `router.refresh()`).

### Fase 5 — Estado vazio

Dois estados distintos (mesma distincao que o Watch Next ja fazia via
`hasTrackedSeries`): usuario sem nenhuma serie acompanhada ve "Voce ainda nao comecou nenhuma
serie" com CTA "Explorar catalogo"; usuario que acompanha series mas nao tem nada pendente ve
"Voce esta em dia com suas series".

### Fase 6/7 — Integracao com Watch Next e acoes

Nenhuma regra paralela: `getContinueWatchingForUser` chama `getWatchNextForUser` diretamente.
Se a logica de "proximo episodio" mudar no futuro, esta secao muda junto, automaticamente.
"Marcar como assistido" usa o mesmo `POST /api/episodes/[id]/progress` (`toggleEpisodeProgress`)
que todo outro botao "marcar assistido" do app usa; apos marcar, `router.refresh()` re-executa
o Server Component do Dashboard, que re-chama `getContinueWatchingForUser` e portanto
`getWatchNextForUser` — o card avanca para o proximo episodio ou desaparece (serie
concluida/sem mais pendencias) automaticamente, sem nenhum estado otimista/paralelo no
cliente.

### Fase 9 — Performance

- `getContinueWatchingForUser` roda dentro do mesmo `Promise.all` de todo o resto do
  Dashboard (`dashboard-home.tsx`) — nunca depois, nunca um componente assincrono aninhado
  que criaria um waterfall sequencial.
- Toda query adicional e um unico `WHERE id IN (...)`, bounded pelo numero de series que o
  usuario acompanha — nunca proporcional ao tamanho do catalogo.
- Imagens (`PosterImage`/`BackdropImage`) reaproveitadas sem alteracao — lazy loading e
  shimmer de carregamento ja embutidos; so os 2 primeiros cards recebem `priority`.

### Decisoes arquiteturais

- **O card compacto "Assistir a seguir" (dentro do grid do Dashboard) foi mantido.** O
  ticket pede para *adicionar* a nova secao como primeira area — nao pede para remover nada
  existente. "Continuar assistindo" e a nova superficie principal de retomada (maior, mais
  rica, primeira dobra); o card compacto continua como atalho rapido para `/watch-next`.
- **`lib/continue-watching` nunca importa Prisma para decidir qual e o proximo episodio** —
  so para enriquecer com campos de exibicao. A unica fonte de verdade do algoritmo continua
  sendo `lib/watch-next/queries.ts`.
- **Nenhuma migration nesta sprint** — todos os campos necessarios (`lastActivityAt`,
  `watchedAt`, `startedAt`, `completionPercent`, `runtimeMinutes`, `episodeCount`) ja
  existiam no schema.

### Limitacoes atuais

- "Progresso da temporada" so aparece quando a temporada do proximo episodio ja tem pelo
  menos 1 episodio assistido pelo usuario (senao a barra fica oculta, para nao mostrar 0%
  vazio sem contexto).
- O botao "Continuar" navega para a pagina do episodio (`/series/[slug]/episode/[id]`), que
  ja tem seu proprio botao de marcar assistido (`EpisodeWatchButton`) — o inSeries nao
  reproduz video, entao "Continuar" significa "ir para onde voce registra que assistiu",
  nao iniciar playback.

## Dashboard Premium — a Home real da plataforma (INSERIES-DASHBOARD-PREMIUM-01)

O Dashboard autenticado deixa de ser uma grade de widgets soltos e passa a ser organizado
como a Home de uma plataforma de streaming: uma ordem fixa de secoes, cada uma com
identidade visual propria, todas reaproveitando servicos ja existentes.

### Fase 1 — Auditoria

Findings antes de qualquer mudanca:

- **Widget redundante identificado**: a antiga secao "Assistir a seguir" (grid de 2
  colunas) e a nova "Continuar assistindo"
  (INSERIES-CONTINUE-WATCHING-EXPERIENCE-01) mostram, na pratica, o mesmo dado (proximo
  episodio pendente por serie) — ambas vem de `getWatchNextForUser`. O ticket desta sprint
  mantem as duas explicitamente na "nova ordem" (posicoes 2 e 6), entao ambas foram
  preservadas: "Continuar assistindo" como a superficie principal (cards grandes, topo da
  pagina), "Watch Next" como lista compacta secundaria mais abaixo — nunca a mesma logica
  duplicada, so duas apresentacoes do mesmo dado de `getWatchNextForUser`.
- **Componentes que ja podiam consumir Smart Lists**: "Bombando Agora" ja existia (sprint
  anterior); "Lancamentos" nao existia como secao do Dashboard, mas `listLancamentos`
  (Smart List do Discovery Engine) ja existia em `lib/catalog/smart-lists.ts` sem nenhum
  consumidor no Dashboard — oportunidade de reuso direto, zero logica nova.
  Nao renderizadas ainda: "Colecoes", "Favoritos" — fora do escopo desta sprint (a lista
  global de superficies que devem seguir a regra de grid inclui esses nomes para
  padronizacao futura, nao exige criar as telas agora).
- **Componentes que ja podiam consumir Discovery Score**: o motor de recomendacoes
  (`lib/recommendations`) ja buscava `qualityScore`/`collectionTags` no candidato, mas
  documentado explicitamente como "purely visual, no provider reads these" — nunca usado
  para pontuar. Oportunidade direta para a Fase 4 desta sprint.
- **Informacao pouco util identificada**: a antiga secao "Estatisticas" mostrava so 3
  numeros em caixas simples (`StatTile`) sem nenhum icone/hierarquia — trocada por uma
  secao dedicada com 7 metricas, icone por metrica e visual "nao administrativo".
- **Sem funcionalidade nova removida**: Calendario/Conquistas/Recap/Notificacoes nao estao
  entre as 10 secoes mandatadas pelo ticket, mas continuam no Dashboard (movidas para uma
  grade secundaria, apos a ordem principal) — nenhuma funcionalidade existente foi cortada.

### Fase 2 — Nova ordem

`components/dashboard/dashboard-home.tsx` renderiza, nesta ordem exata: Saudacao →
Continuar assistindo → Bombando Agora → Lancamentos → Recomendado para voce → Watch Next →
Minha Lista → Suas Estatisticas → Atividade recente → Descobrir mais. Cada secao e um
componente proprio (`components/dashboard/*`), cada um com seu proprio cabecalho/identidade
visual — nunca o mesmo componente reaproveitado com conteudo diferente disfarcado de
"identidade propria".

### Fase 3 — Personalizacao (`components/dashboard/greeting-section.tsx`)

Saudacao contextual por horario (Bom dia/Boa tarde/Boa noite/Boa madrugada), nome do
usuario, e uma linha de fatos — series em andamento, episodios pendentes, ultima atividade,
tempo desde o ultimo acesso — todos de campos ja existentes: `UserStats.overview`
(`lib/analytics`), `UserStats.streaks.lastWatchedAt`, e `User.lastLoginAt` (ja mantido pela
rota de login, so precisou ser adicionado ao `select` de `getCurrentUser`,
`lib/auth/server.ts`). Nenhum schema novo, nenhuma query nova para esta secao especifica.

### Fase 4 — Recomendado para voce: `editorialProvider`

Novo provider (`lib/recommendations/providers/editorial-provider.ts`), plugado no motor de
recomendacoes existente (mesma interface `RecommendationProvider`, mesmo
`combineProviderSignals`, nenhuma logica de scoring duplicada). So gera sinal quando ha
overlap real de Collection Tag ou Keyword entre o candidato e o "seed" do usuario (series
concluidas/assistindo) — nunca generico, por construcao: sem overlap, o provider
simplesmente nao vota naquele candidato. Discovery Score e Quality Score (normalizados 0-1)
so ajustam o ranking *entre* candidatos que ja tem overlap — nunca sao, sozinhos, a razao de
uma recomendacao aparecer. "Status das series" continua reaproveitado via os filtros ja
existentes (`lib/recommendations/filters.ts`, inalterado).

### Fase 5 — Minha Lista (`lib/my-list/`, `components/my-list/`)

Resumo dos grupos Assistindo/Quero assistir/Concluidas/Pausadas/Favoritas. Sem campo de
"favorito" em lugar nenhum do schema (`Rating` existe mas nunca e lido/escrito por nenhum
codigo da aplicacao — auditado, zero usos) — "Favoritas" reaproveita `Review.rating >= 4`,
o mesmo limiar que o motor de recomendacoes ja trata como "avaliacao positiva". Contagens
via `groupBy`, preview de ate 6 series por grupo via uma query bounded por grupo — 6 queries
no total, todas em paralelo, nenhuma proporcional ao catalogo.

### Fase 6 — Estatisticas: provedor predominante

`lib/analytics/providers.ts` (`computeProviderStats`) — nova metrica pura, derivada do
mesmo `AnalyticsDataset` que todo o resto da camada de analytics ja usa (so precisou
adicionar `watchProviders` ao `select` de `dataset.ts`). Conta quantas series (nao
episodios) o usuario acompanha em cada streaming, uma vez por serie. `StatsSection`
(`components/dashboard/stats-section.tsx`) mostra 7 metricas com icone + numero grande —
"sem aparencia administrativa" no lugar da antiga grade de caixas simples.

### Fase 7 — Atividade recente

Reaproveita `ActivityCard` e `getRecentActivityForUser` sem nenhuma alteracao —
`getRecentActivityForUser` ja filtra `where: { userId }` (so as proprias acoes do usuario,
nunca de quem ele segue), exatamente o "Voce terminou/comecou/avaliou" do ticket.

### Fase 8 — Padronizacao de cards

Auditoria encontrou tres valores diferentes de hover-lift entre cards do app:
`hover:-translate-y-0.5` (`Card` interactive, `ContinueWatchingCard`),
`hover:-translate-y-1` (`SeriesCard`, `RecommendationCard`, tile de colecoes da Landing) e
`group-hover:-translate-y-1.5` (`SeriesPosterCard`). Padronizado para `-translate-y-1` em
todos (a maioria ja usava esse valor) — `components/ui/card.tsx`,
`components/continue-watching/continue-watching-card.tsx`,
`components/media/series-poster-card.tsx` e todos os componentes novos desta sprint.
Borda/sombra (`hover:border-border-strong hover:shadow-raised`), raio (`rounded-2xl`/
`rounded-3xl`) e duracao de transicao (`duration-200`/`duration-300 ease-out`) ja eram
consistentes — mantidos como estavam.

### Fase 9/12 — Performance

Toda secao nova busca seus dados no mesmo `Promise.all` de nivel superior do
`DashboardHome` — nenhum componente assincrono aninhado, nunca um waterfall sequencial.
`getMyListSummaryForUser` e o `editorialProvider`'s query extra de seed tags/keywords
seguem a mesma disciplina ja estabelecida (`lib/continue-watching`,
`lib/discovery/engine.ts`): sempre `WHERE id IN (...)` bounded, nunca uma query por
serie/episodio.

### Fase 10 — Regra global de grids fixos

`components/ui/fixed-grid.tsx` — todo grid de listagem usa uma quantidade FIXA de colunas
por breakpoint (nunca `auto-fit`/`auto-fill`, nunca `flex-wrap` com largura variavel). Isso
garante, por construcao (nao por logica de truncar/preencher), que nenhuma linha
intermediaria fica incompleta: um CSS grid de N colunas fixas com itens sem `col-span`
sempre preenche da esquerda para a direita — a unica linha que pode ficar com menos de N
itens e a ultima. Aplicado em: `/series` (catalogo), `/recommendations`, e nas novas secoes
do Dashboard (Bombando Agora, Lancamentos, Recomendado para voce, Minha Lista,
Estatisticas, Descobrir mais). Contagens de itens escolhidas para serem divisiveis por
todos os breakpoints usados (ex.: catalogo usa pageSize 12 com colunas 2/3/4; secoes do
Dashboard usam 8 itens com colunas 2/4/4) — nunca uma linha parcial no meio de uma pagina
"cheia". "Continuar assistindo" e "Watch Next" satisfazem a mesma regra por um mecanismo
diferente: carrossel de largura de card fixa (um numero fixo de cards totalmente visiveis
por vez, por breakpoint) e stack de coluna unica (`N=1` uniforme), respectivamente — ambos
"itens fixos por linha", so que uma linha rola e a outra empilha.

### Decisoes arquiteturais

- **Nenhuma migration nesta sprint** — `Episode.runtimeMinutes`, `Season.episodeCount`,
  `UserSeriesStatus.completionPercent`/`lastActivityAt`/`startedAt`, `User.lastLoginAt` e
  `Review.rating` ja cobriam tudo que as Fases 3/5/6 precisavam.
- **`editorialProvider` nunca substitui os providers existentes** (genre/similar/popular/
  rating/trending) — soma-se a eles no mesmo `combineProviderSignals`, com seu proprio peso
  configuravel (`RECOMMENDATION_WEIGHT_EDITORIAL`, default 0.9 — o mais alto, ja que so
  vota quando ha sinal pessoal real).
- **Calendario/Conquistas/Recap/Notificacoes mantidos, nao removidos** — nao fazem parte da
  ordem mandatada, mas cortar funcionalidade existente nao foi pedido.

### Limitacoes atuais

- "Favoritas" e um proxy (`Review.rating >= 4`), nao um favorito explicito — nao existe
  campo de favorito no schema, e criar um seria uma funcionalidade nova fora do escopo
  ("nao criar funcionalidades paralelas").
- A validacao de mobile/tablet/desktop foi feita via inspecao das classes Tailwind geradas
  (`grid-cols-*` por breakpoint) e revisao manual do layout — este sandbox nao tem
  Playwright/Puppeteer instalado para capturar screenshots reais em múltiplas resolucoes.

## Pagina da Serie Premium (INSERIES-SERIES-PAGE-PREMIUM-01)

A pagina de detalhes de uma serie (`app/series/[id]/page.tsx`) deixa de ser uma lista de
cards soltos e passa a ser a tela mais rica do app: resumir onde o usuario parou, mostrar
tudo sobre a serie, navegar temporadas/episodios, acompanhar progresso, descobrir
recomendacoes, organizar listas, ver reviews e achar conteudo relacionado — tudo em uma
unica pagina, reaproveitando exclusivamente servicos ja existentes.

### Fase 1 — Auditoria

Findings antes de qualquer mudanca:

- **Ambiguidade "proximo episodio"**: a pagina ja tinha um card "Proximo episodio" baseado
  no calendario de estreias (`getNextEpisodeForSeries`, `lib/calendar/queries.ts` — proximo
  a *estrear*, independente de assistido). O ticket pede uma nova secao "Continuar
  Assistindo" baseada em Watch Next (proximo a *assistir*, ja lancado). Sao dois conceitos
  diferentes que passariam a coexistir na mesma pagina — o card do calendario foi renomeado
  para "Proximo lancamento" (nenhuma logica alterada, so o rotulo) para nunca ser confundido
  com a nova secao.
- **Consulta duplicada identificada**: a pagina ja buscava `series` (com temporadas +
  episodios) e `UserEpisodeProgress` para montar a lista de episodios; separadamente,
  `calculateSeriesProgress` (usado por outras rotas) refaz exatamente essas duas consultas
  para calcular percentual/proximo episodio. Corrigido na Fase 12 (ver abaixo) sem alterar o
  comportamento de `calculateSeriesProgress` para nenhum outro chamador.
- **Dados sincronizados e nunca exibidos**: `Series.discoveryScore`, `tagline`,
  `productionCountries`, `numberOfSeasons`/`numberOfEpisodes` existiam no schema/pipeline
  (sprints anteriores) mas nunca apareciam nesta pagina.
- **Recomendacoes ad-hoc**: nao havia nenhuma secao de "series parecidas" na pagina — a
  Fase 9 monta isso reaproveitando o motor de descoberta/recomendacoes existente
  (`searchSeries`, `listMaratonas`, `getRecommendationsForUser`), nunca uma query nova de
  similaridade.
- **Campos genuinamente indisponiveis** (documentados como limitacao, nao implementados):
  nota por episodio (TMDb episode `vote_average` nunca foi capturado pelo pipeline nem existe
  coluna para isso em `Episode`) e curtir/responder em reviews (`Review` nao tem contagem de
  likes nem relacao de thread no schema).

### Fase 2 — Hero Premium

Backdrop full-width com overlay em gradiente, logo oficial com fallback textual
(`SeriesLogoOrTitle`, ja existente), tagline (novo, condicional), badges de status/nota/
Quality Score/**Discovery Score** (novo — `Badge variant="secondary"` com `FlameIcon`),
generos, `CollectionTagList` e `ProviderList` (limitado a 5). Quatro acoes na mesma linha,
sem poluir visualmente: **Continuar assistindo** (link-ancora para a secao da Fase 3,
condicional a existir um `WatchNextItem` para esta serie), **Adicionar a lista**
(`AddToListButton`, novo componente client-side que reaproveita o mesmo endpoint
`POST /api/lists/[id]/items` do `ListItemManager`), **Avaliar** (link-ancora para `#reviews`)
e **Compartilhar** (`ShareButton`, novo — Web Share API com fallback de copiar link,
puramente de UI).

### Fase 3 — Continuar Assistindo

`components/series/series-continue-watching.tsx` reaproveita **exatamente**
`getWatchNextForUser` (`lib/watch-next`, o mesmo algoritmo usado por `/watch-next` e pelo
Dashboard), filtrado no server para o item desta serie
(`watchNextResult.items.find((item) => item.series.id === series.id)`). Nenhuma logica
paralela de "proximo episodio desta serie" foi criada. Mostra codigo do episodio, titulo,
progresso da serie (via a mesma funcao pura da Fase 12), ultimo episodio assistido, quantos
faltam depois deste, botao **Continuar** (link direto para o player do episodio) e o
`WatchNextMarkButton` ja existente para marcar como assistido sem sair da pagina.

### Fase 4/5 — Temporadas e Episodios

`SeasonCard` (`components/series/season-card.tsx`, client component): poster, nome, ano,
contagem de episodios, barra de progresso da temporada, expandir/recolher
(`aria-expanded`, primeira temporada expandida por padrao). "Marcar temporada inteira como
assistida" **nunca criou um endpoint em lote** — dispara a mutation existente
`POST /api/episodes/[id]/progress` uma vez por episodio nao assistido, todas em paralelo
(`Promise.all`), preservando de graca todos os efeitos colaterais que
`toggleEpisodeProgress` ja tem por episodio (feed de atividades, gamificacao,
notificacoes) — um endpoint em lote de verdade teria que replicar tudo isso manualmente.

`EpisodeRow` (`components/series/episode-row.tsx`) ganhou imagem sempre visivel (antes
escondida no mobile), hover premium padronizado (`-translate-y-1`) e badge "Assistido"
quando ja visto. Nota por episodio foi **omitida** (ver Fase 1 — dado nao existe no
pipeline).

### Fase 6 — Producao reorganizada

`ProductionSection` (`components/series/production-section.tsx`): tagline, tipo, status,
criadores, networks, produtoras, **paises de producao** (novo — nunca exibido antes),
idiomas falados, keywords (badges clicaveis) e site oficial — cada campo com sua propria
condicional; a secao inteira retorna `null` se nao houver nenhum dado, nunca um campo vazio
renderizado.

### Fase 7 — Onde Assistir

`WhereToWatchCard` (`components/series/where-to-watch-card.tsx`) — card dedicado, retorna
`null` se a serie nao tiver nenhum provider sincronizado. `ProviderList` (componente
compartilhado) passou a ordenar os providers alfabeticamente antes de renderizar/limitar —
"ordem consistente" pedida pelo ticket, sem alterar a logica de quais providers aparecem.

### Fase 8 — Reviews aprimoradas

`ReviewsSection` (`components/series/reviews-section.tsx`) calcula nota media e contagem a
partir do mesmo array `reviews` que a pagina ja buscava via `getSeriesReviews`
(`lib/social/reviews.ts`, inalterado) — nenhuma query nova. Cards com hover premium
padronizado. **Curtir/Responder nao foram implementados**: o schema de `Review` nao tem
contagem de likes nem relacao de resposta/thread, e o ticket pede explicitamente para
"preparar arquitetura para futuras respostas em thread" (nao para implementar de fato) e
para "nao alterar a regra de review existente" — criar esses campos seria alterar
schema/regra de negocio fora do escopo desta sprint. Documentado aqui como limitacao
deliberada, nao uma funcionalidade meio-pronta.

### Fase 9 — Recomendacoes enriquecidas

`lib/series-page/recommendations.ts` (`getSeriesRecommendations`) monta 4 sub-secoes, cada
uma **inteiramente ocultada quando vazia** (nunca uma lista generica de preenchimento):

| Sub-secao | Fonte | Sinal usado |
| --- | --- | --- |
| Series parecidas | `searchSeries` por Collection Tag e Keyword do topo da propria serie | Discovery Score (ordenacao) |
| Voce tambem pode gostar | `getRecommendationsForUser` (motor de recomendacoes existente) | todos os providers combinados (genero/similar/popular/rating/trending/editorial) |
| Mais da mesma categoria | `searchSeries` por genero | Quality Score (ordenacao) |
| Maratonas | `listMaratonas` (Smart List reaproveitada) | tag "Maratona" |

Nenhuma consulta nova de "similaridade" foi inventada — tudo reaproveita `searchSeries`
(descoberta), `listMaratonas` (Smart Lists) e o motor de recomendacoes, todos ja existentes.
"Voce tambem pode gostar" usa `RecommendationCard` (ja construido para o formato
`ScoredRecommendation`) em vez de `SeriesPosterCard`, ja que o item de recomendacao carrega
um tipo `CandidateSeries` mais estreito que `Series`. Grid: `FixedGrid mobile={2} tablet={4}
desktop={4}` em todas as 4 sub-secoes, alinhado ao limite de 8 itens por secao.

### Fase 10 — Linha do tempo do usuario

`lib/series-page/timeline.ts` (`computeSeriesTimeline`) — funcao pura, sem I/O proprio:
recebe dados que a pagina ja buscou para outras secoes (status, episodios assistidos com
timestamp, review propria) mais uma unica query pequena e aditiva
(`getSeriesAddedToListAt`, `lib/series-page/queries.ts`). Eventos possiveis: Comecou a
assistir, Assistiu [episodio], Concluiu a Temporada [N], Avaliou a serie, Adicionou a uma
lista — ordenados do mais recente ao mais antigo. `SeriesTimeline`
(`components/series/series-timeline.tsx`) so renderiza se houver pelo menos um evento.

**Limitacao conhecida**: `UserSeriesStatus.startedAt` existe no schema mas nunca e escrito
por nenhuma mutation da aplicacao (`upsertSeriesStatus`/`toggleEpisodeProgress`,
`lib/progress/mutations.ts`) — o evento "Comecou a assistir" esta implementado e pronto,
mas so vai aparecer de fato quando uma sprint futura passar a popular esse campo. Corrigir
isso agora exigiria alterar uma mutation de regra de negocio compartilhada, fora do escopo
("nao alterar regras de negocio") desta sprint.

### Fase 11/13 — UX e responsividade

`scroll-behavior: smooth` adicionado globalmente (`app/globals.css`) para os novos links-
ancora (`#continuar-assistindo`, `#reviews`) — a media query `prefers-reduced-motion` ja
existente sobrescreve para `auto` automaticamente, sem nenhum ajuste adicional necessario.
Todo grid novo desta pagina (recomendacoes, "Aparece nestas listas") usa `FixedGrid` — a
mesma regra global de colunas fixas por breakpoint das sprints anteriores.

### Fase 12 — Performance

`calculateSeriesProgress` (`lib/progress/calculate.ts`) teve sua computacao pura extraida
para uma nova funcao exportada, `computeSeriesProgressFromEpisodes(allEpisodes,
watchedIds)`, sem alterar o comportamento/assinatura da funcao original para nenhum outro
chamador. A pagina da serie agora chama a funcao pura diretamente com dados que ja tinha
buscado para renderizar a lista de episodios/temporadas — eliminando o que seria uma segunda
consulta a `series` (com temporadas/episodios) e uma segunda consulta a
`UserEpisodeProgress` para o mesmo usuario/serie. Toda a busca de dados da pagina continua
em um unico `Promise.all` de nivel superior — nenhum componente assincrono aninhado.

### Decisoes arquiteturais

- **Nenhuma migration nesta sprint** — todos os campos usados (`discoveryScore`, `tagline`,
  `productionCountries`, `numberOfSeasons`/`numberOfEpisodes`, `ListItem.createdAt`) ja
  existiam no schema.
- **"Marcar temporada" via loop de chamadas existentes, nunca um endpoint em lote novo** —
  ver Fase 4/5.
- **"Proximo episodio" renomeado para "Proximo lancamento"** — mesma logica de calendario,
  so o rotulo mudou, para coexistir sem ambiguidade com a nova secao "Continuar Assistindo".
- **Curtir/Responder em reviews: arquitetura preparada, nada implementado** — ver Fase 8.

### Limitacoes atuais

- Nota por episodio nao existe (TMDb `vote_average` de episodio nunca foi sincronizado nem
  tem coluna no schema) — omitida da UI, nao inventada.
- "Comecou a assistir" na linha do tempo esta implementado mas estruturalmente nunca vai
  disparar ate uma sprint futura popular `UserSeriesStatus.startedAt` (ver Fase 10).
- Curtir/Responder em reviews sao apenas preparacao de arquitetura (ver Fase 8) — nenhum
  botao funcional foi adicionado.
- Validacao de responsividade feita via inspecao de classes Tailwind e revisao manual do
  layout — este sandbox nao tem Playwright/Puppeteer para screenshots reais.

## Minha Lista Premium (INSERIES-MY-LISTS-PREMIUM-01)

A area "Minha Lista" deixa de ser uma lista simples (3 paginas fragmentadas, sem cobrir
todos os status) e passa a ser o centro de organizacao pessoal do usuario: uma unica pagina
(`/me/minha-lista`) com 6 grupos, busca, filtros, ordenacao, acoes em lote, estatisticas e
recomendacoes, reaproveitando exclusivamente servicos ja existentes.

### Fase 1 — Auditoria

Findings antes de qualquer mudanca:

- **Grupo "Abandonadas" ausente**: `getMyListSummaryForUser` (Dashboard Premium) consultava
  4 estados de `UserSeriesStatus` (WATCHING/WANT_TO_WATCH/COMPLETED/PAUSED) mais Favoritas,
  mas nunca `DROPPED` — o 5o valor do enum `WatchState` — apesar de a UI de status da serie
  (`SeriesStatusActions`) ja ter o botao "Abandonada" havia sprints. Corrigido: a funcao
  agora tambem consulta `DROPPED`, entao o Dashboard passa a mostrar esse grupo de graca.
- **3 paginas fragmentadas, nenhuma completa**: `/me/watching`, `/me/watchlist` e
  `/me/completed` cada uma cobria so 1 dos 5 estados (Pausadas e Favoritas nunca tiveram
  pagina propria, caindo de volta para "/me" no link "Ver tudo" do Dashboard); nenhuma tinha
  busca, filtro, ordenacao ou acao em lote.
- **N+1 real nas 3 paginas antigas**: cada uma buscava os `UserSeriesStatus` do usuario e
  depois chamava `getCatalogSeriesBySlug` (que inclui `seasons`/`episodes`) **uma vez por
  serie**, via `Promise.all` de N queries independentes — nunca uma unica consulta batched.
- **"Minha Lista" (grupos de status) vs. "Minhas Listas" (`/me/lists`)**: sao duas
  funcionalidades genuinamente distintas — a primeira e `UserSeriesStatus` (o status que o
  usuario da a uma serie), a segunda e o modelo `List`/`ListItem` (colecoes nomeadas que o
  usuario cria). Mantidas separadas; "Adicionar as listas" (Fase 7) e a ponte entre as duas.
- **Cabecalho/estatisticas nunca precisam de query propria**: `getUserStats` (lib/analytics)
  ja calcula tudo que as Fases 3 e 9 pedem (series por status, tempo assistido, streak,
  genero/provider predominante) a partir de duas queries reaproveitadas em toda a app —
  zero calculo novo no banco, so duas pequenas funcoes puras (tempo restante estimado e
  status predominante, `lib/my-list/stats.ts`) sobre numeros ja computados.

### Fase 2 — Nova estrutura: 6 grupos independentes

`lib/my-list/queries.ts` (`getMyListFullForUser`) busca, em paralelo, todos os
`UserSeriesStatus` do usuario (os 5 estados) e todas as reviews com nota >= 4 — uma consulta
batched cada, nunca uma por serie. `MyListGroup` (`components/my-list/my-list-group.tsx`)
renderiza cada grupo (Assistindo, Quero assistir, Pausadas, Concluidas, Abandonadas,
Favoritas) com contador, ultima atividade, expandir/recolher e empty state proprio. Uma
serie favoritada por review mas **sem** `UserSeriesStatus` ainda aparece — so no grupo
Favoritas, com um badge "Sem status" — o mesmo caso de borda que o resumo do Dashboard ja
tratava consultando `Review` de forma independente do status.

### Fase 3 — Cabecalho premium

`MyListHeader` (`components/my-list/my-list-header.tsx`): Total de series, Em andamento,
Concluidas, Tempo assistido, Ultima atividade e Sequencia atual — os 6 numeros direto de
`getUserStats(userId)`, chamado uma unica vez no server component da pagina.

### Fase 4 — Cards premium

`MyListItemCard` (`components/my-list/my-list-item-card.tsx`): poster, logo oficial com
fallback (`SeriesLogoOrTitle`), nota, Quality Score, Discovery Score, providers, Collection
Tags, progresso, badge de status, ultima atividade/data de adicao, checkbox de selecao
(Fase 7) e duas acoes rapidas individuais — mudar status (reaproveita
`POST /api/series/[id]/status`, o mesmo endpoint de `SeriesStatusActions`) e remover
(`DELETE /api/series/[id]/status`, novo — ver Fase 7). Hover premium padronizado
(`-translate-y-1`), igual a todo outro card do app.

### Fase 5/6/8 — Filtros, ordenacao e busca

`lib/my-list/filter-sort.ts`: funcoes puras (`filterMyListItems`, `sortMyListItems`,
`getMyListFilterOptions`) que operam inteiramente sobre o array ja carregado pelo server
component — nenhuma filtragem, ordenacao ou busca dispara uma nova consulta. Filtros:
genero, ano, idioma, pais, provider, Collection Tag e keyword (as opcoes de cada dropdown
vem so dos valores presentes na propria lista do usuario, nunca do catalogo inteiro).
Ordenacao: ultima atividade, ultima atualizacao, data adicionada, titulo, popularidade,
Quality Score, Discovery Score, nota, episodios e temporadas — ascendente/descendente.
Busca: titulo, keywords, Collection Tags e providers, tudo client-side
(`MyListToolbar`/`MyListPageClient`), sem endpoint novo.

### Fase 7 — Acoes em lote

`MyListBulkBar` (`components/my-list/my-list-bulk-bar.tsx`) reaproveita as mutations
existentes, uma chamada por serie selecionada em paralelo — o mesmo padrao ja usado por
"marcar temporada inteira" (INSERIES-SERIES-PAGE-PREMIUM-01). Mover status/marcar
concluidas reaproveitam `POST /api/series/[id]/status`; adicionar as listas reaproveita
`POST /api/lists/[id]/items` (o mesmo endpoint do `AddToListButton`). "Remover" precisou de
uma peca de CRUD que faltava — nao havia nenhum jeito de apagar um `UserSeriesStatus`
(so criar/atualizar via `upsertSeriesStatus`) — adicionada como `removeSeriesStatus`
(`lib/progress/mutations.ts`) e `DELETE /api/series/[id]/status`, sem efeito de
atividade/gamificacao (remover nao e um evento a comemorar, so a limpeza reversa de um
`upsertSeriesStatus` anterior).

**"Favoritar" em lote nao foi implementado**: a unica forma de favoritar hoje e uma review
com nota >= 4, e `reviewSchema` exige um `body` nao vazio — criar reviews com texto falso
so para marcar favorito alteraria o significado de "review" (uma regra de negocio
existente) e nao e uma boa pratica. Favoritar continua funcionando normalmente, um de cada
vez, pela review de verdade na pagina da serie.

### Fase 9 — Estatisticas

`MyListStatsSection` (`components/my-list/my-list-stats-section.tsx`): Series, Temporadas
concluidas, Episodios assistidos, Tempo assistido, Tempo restante estimado, Provider
predominante, Genero favorito e Status predominante — tudo de `getUserStats`, os dois
ultimos (tempo restante e status predominante) derivados por duas funcoes puras
(`lib/my-list/stats.ts`) sobre numeros que a funcao ja retorna.

### Fase 10 — Recomendacoes

`lib/my-list/recommendations.ts` (`getMyListDiscovery`) monta 3 sub-secoes, cada uma
inteiramente ocultada quando vazia:

| Sub-secao | Fonte |
| --- | --- |
| Baseado na sua lista | `getRecommendationsForUser` (motor de recomendacoes existente, ja agregado sobre todo o historico do usuario) |
| Complete sua colecao | Collection Tag mais frequente entre as series ja rastreadas + `searchSeries`, excluindo o que o usuario ja tem |
| Porque voce assistiu {titulo} | `getSeriesRecommendations` (INSERIES-SERIES-PAGE-PREMIUM-01) para a serie de maior Discovery Score que o usuario acompanha |

Nenhuma logica de similaridade nova — reaproveita o motor de recomendacoes, `searchSeries` e
a propria funcao de recomendacoes da pagina da serie, os 3 ja existentes.

### Fase 11/13 — UX e responsividade

Todo grid novo (grupos, recomendacoes) usa `FixedGrid` — a mesma regra global de colunas
fixas por breakpoint das sprints anteriores. `scroll-behavior: smooth` (ja global desde
INSERIES-SERIES-PAGE-PREMIUM-01) beneficia os novos links-ancora `#grupo-<estado>` que o
Dashboard e as rotas antigas usam para apontar direto para um grupo.

**Drag-and-drop entre grupos nao foi implementado**: exigiria uma biblioteca de
drag-and-drop nova (nenhuma no projeto) e uma decisao de UX sobre o que "arrastar uma serie
para Concluidas" deveria fazer que nao e trivial de inferir sem alterar a regra de negocio
de status — as acoes em lote (Fase 7) permanecem o mecanismo principal para mover series
entre grupos, decisao explicitamente permitida pelo ticket ("caso drag-and-drop nao seja
viavel... manter acoes em lote como mecanismo principal e documentar a decisao").

### Fase 12 — Performance

`getMyListFullForUser` faz exatamente 2 queries (uma `UserSeriesStatus.findMany`, uma
`Review.findMany`), ambas em paralelo, cada `Series` selecionada com um `select` enxuto
(sem `seasons`/`episodes` — corrigindo o N+1 identificado na Fase 1). As 3 rotas antigas
(`/me/watching`, `/me/watchlist`, `/me/completed`) viraram redirects de uma linha, entao o
N+1 que elas tinham simplesmente deixou de existir em vez de precisar ser corrigido in loco.

### Decisoes arquiteturais

- **Rotas antigas viram redirects, nao sao duplicadas nem apagadas** — `/me/watching`,
  `/me/watchlist` e `/me/completed` agora so chamam `redirect("/me/minha-lista#grupo-...")`;
  nenhum bookmark quebra, nenhuma logica de render fica duplicada.
- **`redirect()` dentro de `/me/*` (Suspense automatico via `app/me/loading.tsx`) nao gera
  mais um 3xx de HTTP puro** — o Next.js emite um digest `NEXT_REDIRECT` embutido no HTML
  (200) que o React do cliente intercepta para navegar de verdade; documentado no smoke
  test (que verifica o digest em vez do status HTTP para esses 3 redirects especificos).
- **Nenhuma migration nesta sprint** — todos os campos usados (`WatchState.DROPPED`,
  `Series.popularityScore`, `UserSeriesStatus.updatedAt`) ja existiam no schema.
- **"Minha Lista" (status) permanece distinta de "Minhas Listas" (`/me/lists`)** — duas
  features reais e diferentes, nao consolidadas artificialmente.

### Limitacoes atuais

- "Favoritar" em lote nao existe (ver Fase 7) — favoritar continua sendo uma review de
  verdade, um de cada vez.
- Drag-and-drop entre grupos nao foi implementado (ver Fase 11) — acoes em lote sao o
  mecanismo principal para mover series entre status, conforme permitido pelo ticket.
- Uma serie favoritada sem nenhum `UserSeriesStatus` mostra "Sem status" e nao tem
  progresso/ultima atividade (so a data da review) — caso de borda esperado, nao um bug.
- Validacao de responsividade feita via inspecao de classes Tailwind e revisao manual do
  layout — este sandbox nao tem Playwright/Puppeteer para screenshots reais.

## Perfil Premium (INSERIES-PROFILE-PREMIUM-01)

O Perfil deixa de mostrar so identidade + 4 secoes basicas (Assistindo/Concluidas/Listas/
Reviews) e passa a ser uma vitrine completa da jornada do usuario: cabecalho com numeros,
estatisticas, destaques, colecoes pessoais e uma timeline filtravel — tudo reaproveitando
servicos ja existentes e preservando integralmente o modelo de privacidade granular ja
estabelecido (`isProfilePrivate` + `showWatchingSeries`/`showWatchedSeries`/`showLists`/
`showReviews`/`showActivity`).

### Fase 1 — Auditoria

Findings antes de qualquer mudanca:

- **`getWatchStateSeries` perdia dados que ja existiam**: retornava so a `Series`, descartando
  `completionPercent`/`lastActivityAt` de `UserSeriesStatus` (usados pelas novas secoes de
  Destaques/Concluidas recentemente) — estendido aditivamente (mesma consulta, mais dois
  campos no retorno), unico consumidor e a propria pagina de perfil.
- **`getProfileActivity` (lib/social/activity.ts) ja e privacy-aware**: reaproveitada
  integralmente para a nova Timeline (Fase 4) — ja aplica a mesma regra granular
  (`showActivity` + a flag especifica de cada tipo de evento) quando o visitante nao e o
  dono, sem precisar de nenhuma logica nova.
- **Nao existe `ActivityType` para "favorito"**: o schema so tem `EPISODE_WATCHED`,
  `SERIES_STATUS_CHANGED`, `SERIES_COMPLETED`, `REVIEW_CREATED`, `LIST_CREATED`,
  `USER_FOLLOWED` — "Favoritos" (Fase 7) e derivado como um filtro sobre
  `REVIEW_CREATED` com `review.rating >= 4`, o mesmo criterio ja estabelecido para
  "Favoritas" desde a Minha Lista Premium.
- **Nenhuma flag de privacidade cobre estatisticas/destaques (agregados novos)**: decisao —
  tratar como extensao dos dois toggles que ja controlam as listas equivalentes
  (`showWatchingSeries`/`showWatchedSeries`); se o usuario escondeu as duas, os agregados
  derivados delas tambem ficam ocultos, em vez de inventar uma flag nova (`canSeeStats`,
  ver Decisoes arquiteturais).
- **Continue Watching/Watch Next nao tem nenhuma flag de privacidade dedicada**: decisao —
  torna-los exclusivos do dono do perfil (nunca exibidos a visitantes, mesmo em perfil
  publico), por serem um conceito pessoal de "retomar de onde parei" sem nenhuma regra
  existente que sancione mostra-lo a terceiros.
- **`getMyListFullForUser` (Minha Lista Premium) e a fonte mais rica ja disponivel** para
  Discovery/Quality medio e Destaques (discoveryScore/qualityScore/collectionTags/
  completionPercent por serie rastreada, ja num unico array) — reaproveitada em vez de
  qualquer consulta nova, com um filtro adicional por estado (WATCHING/COMPLETED) quando o
  visitante nao e o dono, para nunca vazar mais dado do que as flags ja autorizam em
  qualquer outro lugar do perfil.

### Fase 2 — Cabecalho premium

`ProfileHeader` (`components/profile/profile-header.tsx`): avatar/nome/username/data de
cadastro/bio sempre visiveis (identico a antes); a nova linha de numeros (sequencia atual,
series acompanhadas, series concluidas, episodios assistidos, tempo assistido) so aparece
quando a pagina passa `stats` (isto e, quando `canSeeStats` e verdadeiro) — nunca para um
perfil oculto ou com as duas flags de series desligadas.

### Fase 3 — Estatisticas

`ProfileStatsSection` (`components/profile/profile-stats-section.tsx`), mesmo padrao de
tile (icone + numero grande + rotulo) ja usado no Dashboard e na Minha Lista: series,
temporadas concluidas, episodios, tempo assistido, tempo restante e media de conclusao vem
direto de `getUserStats` (nenhuma query nova); Discovery medio e Quality medio sao a unica
coisa que `UserStats` nao tem — calculados em `lib/profile-page/highlights.ts`
(`computeAverageScore`) sobre o mesmo array de `getMyListFullForUser` que a Fase 6 tambem
usa.

### Fase 4/7 — Timeline com filtros

`ProfileTimeline` (`components/profile/profile-timeline.tsx`, client component) reaproveita
`getProfileActivity` (a mesma consulta ja privacy-aware da secao "Atividade" anterior) e
`ActivityCard` (o mesmo card do feed global, sem duplicar o mapeamento tipo→texto) — so
adiciona filtros client-side por cima do array ja buscado: Tudo, Reviews
(`REVIEW_CREATED`), Series (`SERIES_STATUS_CHANGED`), Episodios (`EPISODE_WATCHED`),
Favoritos (`REVIEW_CREATED` com nota >= 4) e Conclusoes (`SERIES_COMPLETED`) — nenhuma
consulta nova por filtro.

### Fase 5 — Colecoes

`ProfileCollections` (`components/profile/profile-collections.tsx`):

| Secao | Fonte | Visibilidade |
| --- | --- | --- |
| Continuar assistindo | `getContinueWatchingForUser` + `ContinueWatchingCard` | so o dono |
| Watch Next | `getWatchNextForUser` + `WatchNextCard` | so o dono |
| Favoritas | mesmo array `reviews` ja buscado, filtrado por nota >= 4 | `canSeeReviews` |
| Concluidas recentemente | mesmo array `completedSeries` (`getWatchStateSeries`) | `canSeeCompleted` |
| Reviews recentes | mesmo array `reviews` ja buscado | `canSeeReviews` |

Nenhuma consulta nova: Favoritas/Reviews recentes reaproveitam o mesmo array de reviews que
a secao "Reviews" ja buscava; Concluidas recentemente reaproveita o mesmo array de
"Concluidas".

### Fase 6 — Destaques

`lib/profile-page/highlights.ts` (`computeProfileHighlights`) — funcao pura, um `max()` por
criterio sobre o mesmo array de series rastreadas (`getMyListFullForUser`, filtrado por
privacidade quando o visitante nao e o dono): Melhor serie avaliada (maior `reviewRating`),
Maior maratona (Collection Tag "Maratona" + mais episodios), Maior Discovery Score, Maior
Quality Score, Maior progresso (`completionPercent`). "Ultima atividade" reaproveita
`streaks.lastWatchedAt` de `getUserStats`, sem calculo proprio. Cada destaque so aparece se
houver um candidato real — nunca um card vazio ou generico.

### Fase 8 — Regra global de grids e responsividade

Toda listagem nova (estatisticas, destaques, colecoes) usa `FixedGrid` — a mesma regra
global de colunas fixas por breakpoint das sprints anteriores. As secoes "Assistindo"/
"Concluidas"/"Listas", que antes usavam um grid ad-hoc (`grid gap-3 sm:grid-cols-2`, sem
regra de coluna fixa por breakpoint), tambem passaram a usar `FixedGrid` nesta sprint —
correcao incidental encontrada na Fase 1/8, nao uma regra de negocio alterada.

### Fase 9 — Performance

Toda a busca de dados da pagina continua em um unico `Promise.all` de nivel superior (9
chamadas em paralelo, cada uma condicionada pela flag de privacidade correspondente) —
nenhum componente assincrono aninhado, nenhuma consulta disparada por secao individualmente.

### Decisoes arquiteturais

- **`canSeeStats` e uma extensao dos toggles existentes, nao uma flag nova**:
  `isOwner || (!isProfilePrivate && (showWatchingSeries || showWatchedSeries))` — cobre
  cabecalho (Fase 2), estatisticas (Fase 3) e destaques (Fase 6) com uma unica regra
  coerente, sem alterar o schema.
- **Continue Watching/Watch Next sao exclusivos do dono** — como nao ha nenhuma regra
  existente que autorize mostrar isso a terceiros, a opcao mais segura e nao inventar uma
  nova exposicao publica; fica como uma lacuna documentada para uma sprint futura que
  queira resolver isso explicitamente.
- **`getMyListFullForUser` filtrado por estado para visitantes**: usado para Destaques e
  medias, mas restrito a `WATCHING`/`COMPLETED` (as unicas com flag propria) quando quem
  ve nao e o dono — nunca vaza mais dado do que `canSeeWatching`/`canSeeCompleted` ja
  autorizam.
- **Nenhuma migration nesta sprint** — todos os campos usados ja existiam no schema.

### Limitacoes atuais

- Nao existe uma flag de privacidade dedicada para estatisticas/destaques/colecoes; elas
  reaproveitam os toggles de series existentes (ver Decisoes arquiteturais) — um usuario
  que queira esconder so os destaques, mantendo as listas de series visiveis, nao consegue
  fazer essa distincao fina hoje.
- Continue Watching/Watch Next no perfil sao exclusivos do dono — nunca aparecem para
  visitantes, mesmo em um perfil publico.
- Validacao de responsividade feita via inspecao de classes Tailwind e revisao manual do
  layout — este sandbox nao tem Playwright/Puppeteer para screenshots reais.

## Reviews e Comentarios Premium (INSERIES-REVIEWS-COMMENTS-PREMIUM-01)

As Reviews deixam de ser uma lista simples de nota+texto e passam a ser o principal ponto de
interacao social do inSeries: cards enriquecidos, comentarios e respostas reais, ordenacao e
filtros, estatisticas e integracao com Perfil/Dashboard/Timeline — a base explicita para o
futuro Feed Social e Gamificacao social citados no roadmap do produto.

### Fase 1 — Auditoria

Findings antes de qualquer mudanca:

- **`ReviewsSection`/`ReviewForm` ja existiam** (INSERIES-SERIES-PAGE-PREMIUM-01) mas eram
  minimos: card com avatar+username+nota+data+corpo, sem spoiler, sem comentarios, sem
  ordenacao/filtro. `getSeriesReviews`/`getOwnReview`/`upsertReview`/`deleteReview`
  (`lib/social/reviews.ts`) ja cobriam toda a regra de negocio de CRUD de review e foram
  reaproveitados integralmente.
- **Nao existia nenhuma tabela de comentario ou curtida no schema.** `Review` nao tinha
  `containsSpoiler`. `ActivityType` nao tinha um valor para "comentou".
- **`recordActivity`/`activityInclude`/`typeVisibilityBranches`
  (`lib/social/activity.ts`) e `ActivityCard`/`ProfileTimeline` ja sao genericos o
  suficiente** para receber um novo `ActivityType` aditivo sem quebrar nada — confirmado
  meia hora depois quando `COMMENT_CREATED` foi adicionado ao enum e o unico ponto que
  quebrou de fato foi um `Record<ActivityType, ...>` em `activity-card.tsx` (ver
  Decisoes/riscos abaixo).
- **Bug pre-existente encontrado e corrigido**: `app/admin/reviews/page.tsx` mostrava
  `{review.rating}/10`, mas a nota e sempre 1-5 em toda a interface publica — correcao
  trivial de exibicao, nao uma regra de negocio alterada.
- **`lib/analytics/dataset.ts` (o motor de estatisticas do Dashboard/Perfil) nunca buscou
  reviews** — so progresso de episodio e status de serie. Estatisticas de review (Fase 7)
  precisaram de um modulo novo (`lib/social/review-stats.ts`), nao uma extensao do
  pipeline de analytics existente, para nao misturar dois dominios de dados que hoje sao
  independentes.
- **Reaproveitamento identificado para Comentarios**: o padrao de mutacao client
  (`useTransition` + `fetch` + toast + `router.refresh()`) usado em toda a Minha Lista/
  Perfil (ex.: `my-list-item-card.tsx`) e o padrao de rota aninhada com dois parametros
  (`app/api/lists/[id]/items/[itemId]/route.ts`) foram reaproveitados integralmente para
  `app/api/reviews/[id]/comments/[commentId]/route.ts`.

### Fase 2 — Schema (aditivo)

Migration `reviews_comments_premium`, puramente aditiva (nenhuma coluna/constraint
existente alterada ou removida):

- `Review.containsSpoiler Boolean @default(false)` — preserva todas as reviews existentes
  exatamente como estavam.
- Novo model `Comment` (`id`, `userId`, `reviewId`, `parentId?` para uma camada de
  resposta via auto-relacao, `body`, `hiddenByAdminAt?`, timestamps), com
  `onDelete: Cascade` em `userId`/`reviewId`/`parentId` — apagar uma review ou um
  comentario-pai tambem apaga os comentarios/respostas dependentes.
  `hiddenByAdminAt` espelha o mesmo campo de moderacao ja usado por `Review`/`List`,
  preparando o terreno para uma futura tela de moderacao de comentarios — que **nao** foi
  construida nesta sprint (fora de escopo, ver Limitacoes).
- `ActivityType` ganhou `COMMENT_CREATED`; `Activity` ganhou `commentId?` + relacao
  `comment?` — mesmo padrao exato de `reviewId`/`listId`/etc.

### Fase 2/8 — Reviews Premium (cards enriquecidos)

`ReviewsSection` (`components/series/reviews-section.tsx`) agora mostra, por review:
avatar, nome, username, data relativa, nota, badge "Contem spoiler" (com o corpo ocultado
ate o leitor clicar para revelar), badge "Somente voce" (reaproveitado), contagem de
comentarios+respostas, e um atalho "Editar sua review" que rola ate o `ReviewForm` (ancora
`#review-form`) — nenhuma logica de edicao nova, so um link para o formulario que ja
existe. O cabecalho da secao mostra Quality Score/Discovery Score/Collection Tags da
propria serie (`series.qualityScore`/`series.discoveryScore`/`series.collectionTags`, ja
carregados pela pagina — nenhuma query nova), no mesmo estilo de badge usado em
`my-list-item-card.tsx`.

`ReviewForm` (`components/reviews/review-form.tsx`) ganhou um `Checkbox` "Contem spoiler"
(`components/ui/checkbox.tsx`, ja existente) que viaja no mesmo POST de sempre.

### Fase 3/4 — Comentarios e Respostas (implementados de verdade)

`lib/social/comments.ts`: `createComment`/`updateComment`/`deleteComment`/
`getCommentsForReview`, todas reaproveitando o mesmo padrao `{ ok, error }` de
`lib/social/reviews.ts`/`lib/social/lists.ts`:

- **Permissao herdada da review, nao duplicada**: `canViewReview` (privada ao modulo) so
  permite comentar em uma review que o autor do comentario ja pode ver (dono da review, ou
  review `PUBLIC` e nao oculta por moderacao) — a mesma regra de `getSeriesReviews`, sem
  reimplementa-la.
- **Uma camada de resposta**: `createComment` recusa `parentId` de um comentario que ja e
  ele proprio uma resposta (`parent.parentId` truthy) — respostas nao podem ter
  sub-respostas, mantendo a UI de "expandir/ocultar respostas" simples.
- **Apagar com cascata**: apagar um comentario com respostas apaga as respostas junto
  (`onDelete: Cascade` no schema, nao uma checagem manual em codigo).
- Rotas: `POST /api/reviews/[id]/comments` (criar, aceita `parentId` opcional),
  `PATCH /api/reviews/[id]/comments/[commentId]` (editar, so o autor),
  `DELETE /api/reviews/[id]/comments/[commentId]` (apagar, so o autor) — todas usando
  `getApiUser`/`withApiObservability`, o mesmo padrao de toda rota da aplicacao.
- `components/reviews/comment-section.tsx` (client): compositor de comentario, editar/
  apagar o proprio (com `ConfirmDialog`, reaproveitado de `review-form.tsx`), responder,
  expandir/ocultar respostas — tudo com o padrao `useTransition` + `fetch` + toast +
  `router.refresh()` ja estabelecido.
- **Sem N+1**: `getSeriesReviews` (`lib/social/reviews.ts`) traz comentarios+respostas
  aninhados na mesma consulta via `include` — a pagina da serie nunca busca comentarios
  review por review.

### Fase 5 — Curtidas (decisao deliberada: NAO implementadas)

Curtidas em Reviews e em Comentarios **nao foram implementadas**, por instrucao explicita
e incondicional do ticket ("nao criar tabelas ou regras fora do escopo desta sprint").
Nenhuma coluna de contagem, nenhuma tabela `Like`, nenhum botao "Curtir" foi adicionado a
nenhum componente — a mesma decisao ja tomada para "Curtir"/"Responder" na
INSERIES-SERIES-PAGE-PREMIUM-01, agora reafirmada e estendida explicitamente para cobrir
tambem os novos Comentarios. A opcao de ordenacao "Mais curtidas" (Fase 6) permanece
visivel na UI (o ticket a lista como obrigatoria), mas e um no-op funcional — ver Fase 6.

### Fase 6 — Ordenacao e filtros

`lib/social/review-sort-filter.ts` — funcoes puras sobre o array de reviews ja buscado
(nenhuma query nova por troca de opcao):

| Ordenacao | Criterio |
| --- | --- |
| Mais recentes | `updatedAt` decrescente |
| Mais relevantes | numero de comentarios+respostas decrescente — um sinal real, so possivel porque esta sprint introduziu Comentarios (nao uma heuristica inventada) |
| Melhor avaliadas | `rating` decrescente |
| Mais curtidas | **no-op documentado**: sem dado de curtida (Fase 5), ordena por recencia de forma estavel |

| Filtro | Criterio |
| --- | --- |
| Todas | sem filtro |
| Somente com spoiler | `containsSpoiler === true` |
| Sem spoiler | `containsSpoiler === false` |
| Somente minhas | `userId === viewerId` |

"Somente amigos" (mencionado no ticket como filtro futuro condicional) nao foi
implementado: o inSeries nao tem um conceito de "amigo" (so `Follow` unidirecional) e o
ticket explicitamente marca esse filtro como "quando aplicavel futuramente".

### Fase 7 — Estatisticas

`lib/social/review-stats.ts`:

- `getUserReviewStats(userId)`: quantidade de reviews, nota media, reviews este mes,
  reviews este ano — uma unica query (`prisma.review.findMany` so com `rating`/
  `createdAt`) seguida de computo puro em memoria.
- `getMostReviewedSeries()`: a serie com mais reviews publicas, um agregado **GLOBAL**
  (`prisma.review.groupBy`) — nao por usuario. O `@@unique([userId, seriesId])` de
  `Review` torna uma versao "por usuario" sempre 0 ou 1, entao "serie mais avaliada"
  so faz sentido como um destaque cross-usuario.
- "Media das notas" e "nota media do usuario" (dois itens distintos no ticket) sao
  tratados como o mesmo numero neste contexto por-usuario — nao ha uma segunda media
  distinta para mostrar sem inventar um segundo conceito.

`ReviewsStatsSection` (`components/reviews/reviews-stats-section.tsx`) renderiza os quatro
numeros pessoais + o destaque global de serie mais avaliada, no mesmo padrao de tile
(icone + numero grande + rotulo) usado por `ProfileStatsSection`/`StatsSection`.

### Fase 8 — Integracao

| Superficie | Integracao |
| --- | --- |
| Pagina da Serie | cards enriquecidos + comentarios/respostas + ordenacao/filtro (Fases 2-6) |
| Perfil | `ReviewsStatsSection` apos a secao "Reviews" existente, sob a mesma flag `canSeeReviews` |
| Dashboard | `StatsSection` ganhou uma tile "Reviews escritas" (`getUserReviewStats(user.id).count`, no mesmo `Promise.all` de nivel superior, sem waterfall) |
| Timeline (Perfil/Feed) | `COMMENT_CREATED` flui por `recordActivity`/`getProfileActivity`/`ActivityCard` sem nenhum sistema de atividade paralelo; `ProfileTimeline` ganhou o filtro "Comentarios" |
| Notificacoes | **fora de escopo** — nenhuma notificacao nova para comentario/resposta recebido (ver Limitacoes) |
| Admin/Moderacao | bug de exibicao `/10` corrigido para `/5` (Fase 1); nenhuma tela de moderacao de comentario construida (schema preparado via `hiddenByAdminAt`, ver Limitacoes) |

### Fase 9/10/11 — UX, performance e responsividade

- Hover premium (`hover:-translate-y-1 hover:shadow-raised`), skeletons/empty states
  (`EmptyState`) e toasts de sucesso/erro reaproveitam os componentes de UI ja existentes
  — nenhum componente visual novo alem do `MessageCircleIcon` (`components/ui/icons.tsx`)
  e do checkbox de spoiler.
- Zero N+1: comentarios+respostas vem aninhados numa unica consulta (`getSeriesReviews`);
  ordenacao/filtro/estatisticas pessoais operam em memoria sobre dados ja buscados.
- Reviews/comentarios continuam uma lista vertical (`space-y-3`), o mesmo padrao de
  "stream" ja usado por Timeline/Feed/Notificacoes — a regra global de grid fixo
  (`FixedGrid`) se aplica a `ReviewsStatsSection` (grades de tile), nao a listas de
  conteudo de largura total.

### Riscos e decisoes tecnicas

- **`Record<ActivityType, ...>` nao e aditivo por si so**: `typeIcons` em
  `activity-card.tsx` e um `Record` sobre o union completo de `ActivityType` — adicionar
  `COMMENT_CREATED` ao enum quebrou a tipagem ate a chave ser adicionada (o `switch` com
  `default` em `getActionContent` nao quebrou). Corrigido adicionando a chave; vale lembrar
  essa diferenca (`Record` completo vs. `switch`+`default`) para qualquer futura extensao de
  enum neste arquivo.
- **Rota nova `/api/reviews/[id]/comments`**: nao existia nenhuma rota `/api/reviews/*`
  antes (reviews sempre viviam sob `/api/series/[id]/reviews`); comentarios pertencem
  conceitualmente a review, entao ganharam seu proprio namespace em vez de aninhar ainda
  mais sob `/api/series`.

### Limitacoes atuais (funcionalidades preparadas so arquiteturalmente)

- **Curtidas (Reviews e Comentarios)**: nenhuma tabela, nenhuma coluna, nenhum componente —
  decisao deliberada desta sprint (Fase 5), nao uma lacuna acidental.
- **Moderacao de comentarios**: o schema ja tem `Comment.hiddenByAdminAt` (mesmo padrao de
  `Review`/`List`), mas nenhuma tela `/admin/comments` ou rota `hide`/`restore` foi
  construida — preparado estruturalmente, fora do escopo desta sprint.
- **Notificacoes de comentario/resposta**: nenhum evento novo em `lib/notifications/events.ts`
  — comentar na review de outro usuario, ou receber uma resposta, nao gera notificacao.
- **"Somente amigos" (filtro)**: nao implementado — o inSeries nao tem conceito de
  "amigo" (so `Follow` unidirecional); o proprio ticket marca esse filtro como aplicavel
  "futuramente".
- Validacao de responsividade feita via inspecao de classes Tailwind/`FixedGrid` e
  requisicoes HTTP diretas — este sandbox nao tem Playwright/Puppeteer instalado como
  dependencia do projeto para screenshots reais.

## Feed Social Premium (INSERIES-SOCIAL-FEED-01)

O Feed (ja existia como uma lista simples de `ActivityCard`, Para voce/Global) passa a ser o
centro de descoberta e interacao entre usuarios: cards premium, filtro/ordenacao e 4 blocos
de descoberta — tudo derivado do MESMO sistema de atividades ja existente
(`lib/social/activity.ts`), preparando o terreno para a futura Gamificacao.

### Fase 1 — Auditoria

Findings antes de qualquer mudanca:

- **O Feed ja existia** (`app/feed/page.tsx`, `components/feed/activity-card.tsx`): abas
  Para voce/Global reaproveitando `getPersonalFeed`/`getGlobalFeed`
  (`lib/social/activity.ts`, ja privacy-aware via `typeVisibilityBranches`). Faltavam cards
  enriquecidos, filtro/ordenacao e blocos de descoberta — nao faltava nenhum sistema de
  atividades novo.
  - Iniciou/pausou/abandonou uma serie: `SERIES_STATUS_CHANGED` (`metadata.to`).
  - Concluiu: `SERIES_COMPLETED`. Review publicada: `REVIEW_CREATED`. Episodio assistido:
    `EPISODE_WATCHED`. Comentario/resposta: `COMMENT_CREATED` (a mesma atividade serve para
    os dois — uma resposta e so um `Comment` com `parentId`, ver Fase 3).
- **`Dashboard`'s `ActivitySection` ja linkava para `/feed`** ("Ver feed") — a integracao
  Dashboard -> Feed (Fase 6) ja existia, nenhuma mudanca necessaria ali.
- **`activityInclude` nao trazia `review._count.comments` nem `comment.parentId`**:
  necessarios para "Mais comentados" (Fase 4) e para distinguir "comentou" de "respondeu"
  (Fase 3) — adicionados aditivamente (mais dois campos `select`, mesma query).
- **Nao ha (e nao deveria haver) uma query dedicada para "trending"/"discussoes"/"usuarios
  ativos"**: o ticket exige reaproveitar dados existentes e nunca duplicar consultas — a
  unica forma de fazer isso sem tocar a privacidade e derivar os 4 blocos EM MEMORIA do
  mesmo batch de atividades que a lista principal ja busca (ver Fase 5).

### Fase 2 — Feed (agregacao)

Nenhum evento novo precisou ser criado — `getPersonalFeed`/`getGlobalFeed` ja agregam todos
os tipos listados no ticket. A unica mudanca foi buscar um batch maior por requisicao
(`FEED_BATCH_SIZE = 150`, em vez do `limit=30` usado pelas paginas antigas) para que o MESMO
resultado alimente a lista principal E os 4 blocos de descoberta — nunca duas consultas para
a mesma tela (Fase 6/8).

### Fase 3 — Cards premium

`ActivityCard` (`components/feed/activity-card.tsx`) ganhou, sem deixar de ser um Server
Component:

- **Contexto**: preview do corpo da review/comentario — respeitando spoiler (`containsSpoiler`
  suprime o preview, mostra so um aviso, nunca revela o texto no feed).
- **Badges**: "Spoiler" quando aplicavel; contagem da thread (`review._count.comments`) para
  reviews e comentarios.
- **Atalho rapido**: link "Ver review" para `/series/{slug}#reviews` (a mesma ancora que a
  Pagina da Serie ja usa para a secao de reviews).
- **Comentario vs. resposta**: `activity.comment.parentId` distingue "comentou na review de"
  de "respondeu a um comentario na review de" — nenhum `ActivityType` novo, so uma leitura
  condicional do mesmo campo aditivo.
- **Hover premium**: `hover:-translate-y-1 hover:shadow-raised`, o mesmo padrao de elevação
  usado em todos os cards do app.

### Fase 4 — Organizacao

`lib/social/feed-sort-filter.ts` — funcoes puras sobre o array de atividades ja buscado
(mesmo padrao de `review-sort-filter.ts`/`ProfileTimeline`, nenhuma query nova por troca de
opcao):

| Filtro | Criterio |
| --- | --- |
| Tudo / Reviews / Comentarios / Series / Episodios / Conclusoes | `activity.type` |

| Ordenacao | Criterio |
| --- | --- |
| Recentes | `createdAt` decrescente |
| Relevantes | peso por tipo (reviews/comentarios > conclusoes/listas > follows/status > episodios), empatado por recencia |
| Mais comentados | `review._count.comments` decrescente (0 para atividades sem review associada), empatado por recencia |

`components/feed/feed-activity-list.tsx` (client) tambem inclui uma revelacao progressiva
("Carregar mais", 15 por vez) sobre o mesmo array ja em memoria — ver Fase 7/limitacoes para
a diferenca entre isso e scroll infinito real.

### Fase 5 — Descoberta

`lib/social/feed-discovery.ts` — os 4 blocos são funções puras que agregam o MESMO batch de
atividades (privacy-filtrado por `getGlobalFeed`/`getPersonalFeed`) já em memória, nunca uma
query nova em `Review`/`Comment`/`User` diretamente — isso é o que garante que os blocos
herdam automaticamente a mesma política de privacidade das atividades:

- **Trending entre usuarios**: contagem de atividades por serie no batch, top N com poster.
- **Reviews em destaque**: atividades `REVIEW_CREATED` deduplicadas por review, ordenadas por
  numero de comentarios e depois nota.
- **Discussoes recentes**: atividades `COMMENT_CREATED`, na ordem em que ja vem (o batch já é
  `createdAt desc`).
- **Usuarios ativos**: contagem de atividades por usuario no batch, top N.

`components/feed/feed-discovery-panel.tsx` (Server Component) renderiza os 4 blocos; "nunca
listas genericas" — cada bloco só aparece se tiver pelo menos um item real, nunca um
placeholder vazio.

### Fase 6 — Integracao

| Superficie | Integracao |
| --- | --- |
| Dashboard | `ActivitySection` ja linkava para `/feed` (pre-existente, sem mudanca) |
| Pagina da Serie | "Ver review" (Fase 3) linka para `/series/{slug}#reviews` |
| Reviews/Comentarios | `getSeriesReviews`/`lib/social/comments.ts` inalterados — o Feed so LÊ `Activity`, nunca duplica a logica de CRUD |
| Timeline (Perfil) | mesma `getProfileActivity`/`ActivityCard`, agora com os badges/contexto da Fase 3 tambem la |
| Perfil | nenhuma mudanca necessaria — `ProfileTimeline` ja usa o mesmo `ActivityCard` |

Nenhuma consulta duplicada: o Feed sempre le de `getPersonalFeed`/`getGlobalFeed`
(`lib/social/activity.ts`), o mesmo modulo que ja alimentava Timeline/Dashboard.

### Fase 7 — UX

Hover premium (Fase 3), skeletons (`app/feed/loading.tsx`, ja existia), empty states
(`EmptyState`, reaproveitado com copy especifico por aba/filtro), feedback visual (badges/
contagens ja atualizadas a cada render). "Scroll infinito quando viavel" foi interpretado
como **revelacao progressiva sobre o array ja buscado** ("Carregar mais", Fase 4) — nao um
`IntersectionObserver` com paginacao server-side nova, para nao introduzir uma segunda forma
de paginar atividades (`getGlobalFeed`/`getPersonalFeed` usam `take`/`limit`, nao cursor).

### Fase 8 — Performance

- Zero N+1: um unico batch (`getGlobalFeed`/`getPersonalFeed`) alimenta lista + descoberta;
  os 4 blocos de descoberta sao `Array.reduce`/`sort` em memoria, nao consultas.
  `review._count.comments` e um agregado do Prisma no mesmo `include`, nao uma subquery por
  atividade.
- Cache/RSC preservados: `FeedDiscoveryPanel` continua Server Component; so
  `FeedActivityList` (filtro/ordenacao/paginacao) precisa ser client.
- Sem regressao: `getGlobalFeed`/`getPersonalFeed`/`getRecentActivityForUser`/
  `getProfileActivity` mantem a mesma assinatura e comportamento — so o `activityInclude`
  compartilhado ganhou 2 campos aditivos.

### Fase 9 — Responsividade

Lista principal continua uma pilha vertical (`space-y-3`, o mesmo padrao de Timeline/
Notificacoes); os blocos "Trending"/"Usuarios ativos" (grades de tile) usam `FixedGrid` —
a mesma regra global de colunas fixas por breakpoint do resto do app.

### Riscos e decisoes tecnicas

- **Objetos `ActivityFeedItem` completos cruzam a fronteira client/server**:
  `FeedActivityList` e um Client Component que recebe o array inteiro (mesmo padrao ja
  usado por `ProfileTimeline` desde a Perfil Premium) — o payload RSC serializado inclui
  campos nao renderizados na tela (ex.: `review.body` de uma atividade de comentario).
  Avaliado e considerado seguro: toda atividade que chega ao array ja passou pelo filtro de
  privacidade de `typeVisibilityBranches` (`visibility: "PUBLIC"` + flags do dono da
  atividade), entao nenhum campo de uma review/comentario efetivamente PRIVADO atravessa essa
  fronteira — o unico conteudo "extra" serializado e sempre de algo que a query ja autorizou
  mostrar a este viewer.
- **"Relevantes" (Fase 4) usa um peso fixo por tipo de atividade**, nao um calculo
  aprendido/dinamico — é uma heuristica simples e documentada (reviews/comentarios geram mais
  conversa que um episodio assistido), nao uma tentativa de replicar um algoritmo de feed
  real.

### Limitacoes atuais

- "Carregar mais" e uma revelacao progressiva sobre o array ja buscado (ate
  `FEED_BATCH_SIZE`), nao scroll infinito com paginacao server-side ilimitada — atividades
  alem do batch inicial (150) so aparecem num proximo carregamento de pagina.
- Os blocos de descoberta refletem apenas o batch já buscado (as mesmas ~150 atividades mais
  recentes), não uma janela de tempo fixa (ex.: "últimos 7 dias") — em um feed com pouco
  volume, os 4 blocos podem parecer parecidos com a lista principal.
- Validacao de responsividade feita via inspecao de classes Tailwind/`FixedGrid` e
  requisicoes HTTP diretas — este sandbox nao tem Playwright/Puppeteer instalado como
  dependencia do projeto para screenshots reais.

## Dashboard e Navegacao Reestruturados (INSERIES-DASHBOARD-UX-AND-NAVIGATION-01)

Ticket com um principio central: o Dashboard responde **"o que eu preciso fazer agora?"**,
nao "qualquer informacao que existe no sistema", e a navegacao possui **um unico caminho**
por modulo — nunca dois menus levando ao mesmo lugar.

**Fase 1 — Auditoria (o que foi encontrado)**

- `/me` era um segundo Dashboard completo, mas nenhum link em toda a aplicacao apontava
  para ele (`grep href="/me"` nao teve nenhuma ocorrencia) — puro codigo morto de navegacao.
- O Dashboard (`components/dashboard/dashboard-home.tsx`) tinha 10 secoes principais mais um
  grid secundario de 4 cards de preview (Proximos lancamentos, Conquistas, Recap,
  Notificacoes) — 13 fetches em paralelo so para renderizar a Home.
- Bombando Agora, Lancamentos e Watch Next repetiam, com outro recorte, o mesmo papel que
  Continuar Assistindo ja cumpria: "o que eu deveria assistir agora".
- Minha Lista, Estatisticas, Conquistas e Recap apareciam como preview no Dashboard **e**
  como pagina propria — a mesma informacao duas vezes.
- `components/me/me-tabs.tsx` (menu horizontal de pills) era renderizado em 8 paginas
  (`/me`, `/me/stats`, `/me/recap`, `/me/achievements`, `/me/minha-lista`, `/me/lists`,
  `/me/recap/[year]`, `/me/recap/[year]/[month]`) — navegacao duplicada com a Sidebar, que
  ja tem entradas para a maioria dessas paginas.
- Badges de status/nota/collection tag sobrepostos a poster/backdrop usavam `Badge`, cujo
  fundo de baixa opacidade (`bg-primary/12` etc.) e adequado sobre um card solido mas nao
  garante contraste sobre uma imagem arbitraria.
- Notificacoes tinham pagina dedicada (`/notifications`) mais um link no Header — um clique
  extra para algo que deveria ser imediato, e uma pagina inteira para uma lista que cabe num
  dropdown.
- `/me/lists` (criacao/gestao pessoal de listas) e `/lists` (navegacao publica de listas) sao
  paginas genuinamente diferentes — nao foram fundidas, mas `/me/lists` ganhou um link
  contextual de volta para `/lists` (controle interno legitimo, nao um menu de navegacao).

**Fase 2/3 — Dashboard reduzido a painel de acompanhamento diario**

`DashboardHome` caiu de 13 fetches/10+ secoes para **5 fetches e 5 secoes**: Saudacao,
Continuar assistindo, Proximos episodios (promovido do grid secundario, agora com
`EmptyState` no lugar do placeholder ad-hoc), Recomendado para voce (recorte de 6 em vez de
8), Atividade recente, e um novo bloco de **Atalhos rapidos**
(`components/dashboard/quick-shortcuts-section.tsx`) para Assistir a seguir/Minha
Lista/Estatisticas/Recap/Conquistas — paginas que passaram a existir *apenas* la, sem
repetir conteudo no Dashboard. Bombando Agora, Lancamentos, Watch Next, Minha Lista,
Estatisticas, Conquistas, Recap e Notificacoes deixaram de aparecer no Dashboard; os
componentes que ficaram sem nenhum outro consumidor
(`discover-more-section.tsx`, `watch-next-section.tsx`, `stats-section.tsx`,
`dashboard-poster-row.tsx`, `my-list-section.tsx`) foram removidos.

**Fase 4 — Recomendacoes com cards mais largos**

`app/recommendations/page.tsx`: `FixedGrid` passou de `desktop={4} wide={6}` para
`desktop={3} wide={4}` — menos colunas, mais largura por card, mesma regra global de grid
fixo (nunca `auto-fit`/`auto-fill`).

**Fase 5 — Contraste de badges sobre poster (`PosterBadge`)**

Novo `components/media/poster-badge.tsx`: mesmo vocabulario de variantes de `Badge`
(`BadgeVariant`), mas usando os pares solidos `bg-*`/`text-*-foreground` que `Button` ja usa
— tokens de contraste AA ja definidos em `app/globals.css` para light/dark, so nao estavam
sendo reaproveitados em contexto de overlay. `CollectionTagBadge`/`CollectionTagList`
ganharam uma prop `overlay` para trocar entre `Badge` (fundo solido, contexto de card) e
`PosterBadge` (sobreposto a imagem) sem duplicar o componente. Aplicado em todo badge que
fica sobre poster/backdrop: `SeriesCard`, `SeriesPosterCard`, `RecommendationCard`,
`CinematicHero`, `ContinueWatchingCard`.

**Fase 6 — Remove navegacao duplicada**

`MeTabs` foi removido das 7 paginas que o usavam (o `/me` que sobrou depois da Fase 2 nao
tinha mais motivo pra existir — virou um simples `redirect("/")`) e o componente em si foi
deletado. A Sidebar volta a ser o unico mecanismo de navegacao entre modulos.

**Fase 7/8/9 — Sino do Header vira centro de notificacoes**

A pagina dedicada `/notifications` foi removida (junto com `notifications-nav-link.tsx`,
`notification-item.tsx`, `mark-all-read-button.tsx`). No lugar: `NotificationBell` (Server
Component, busca o unread count inicial via `countUnreadNotifications`) +
`NotificationBellClient` (Client, o Dropdown em si) — reaproveitando 100% de
`lib/notifications/service.ts` e das rotas `/api/notifications` ja existentes, nenhuma regra
de negocio nova. O Dropdown cobre loading (skeleton), erro (com "Tentar novamente"), vazio
(`EmptyState`), scroll interno limitado (`max-h-[26rem] overflow-y-auto`, nunca ultrapassa a
viewport), fechamento por clique fora ou Escape, e marcar uma/todas como lidas. Clicar numa
notificacao navega direto para o `href` que o proprio `service.ts` ja precalcula por tipo de
notificacao (review, comentario, feed, perfil, lista) — nunca uma pagina intermediaria.

**Fase 10/11 — Responsividade e acessibilidade**

Nenhuma classe `auto-fit`/`auto-fill` foi introduzida; todo grid novo/alterado usa
`FixedGrid` com colunas fixas por breakpoint (mobile/tablet/desktop/wide), a mesma regra
global ja em vigor no resto do app. O Dropdown de notificacoes usa `aria-haspopup="menu"`,
`aria-expanded`, `aria-label` com contagem de nao lidas, fecha com Escape e ao clicar fora,
e o `IconButton` de "marcar como lida" exige `label` (acessibilidade ja garantida pelo
Design System). Como nos sprints anteriores, a validacao de 360/390/412/768/1024/desktop
amplo foi feita por inspecao das classes Tailwind responsivas e requisicoes HTTP diretas —
este sandbox nao tem Playwright/Puppeteer instalado como dependencia do projeto para
screenshots reais.

**Limitacoes conhecidas**

- `getWatchNextForUser`, `getMyListSummaryForUser`, `getUserReviewStats`,
  `getUserAchievementsOverview`, `listAvailableRecaps`, `listBombandoAgora` e
  `listLancamentos` continuam existindo em `lib/` (regra do ticket: nao alterar
  logica/servicos existentes) — apenas deixaram de ser chamados a partir do Dashboard;
  suas paginas dedicadas continuam usando-os normalmente.
- Validacao visual continua limitada a inspecao de HTML/classes (sem Playwright no
  sandbox), igual a todos os sprints anteriores deste projeto.

## Dashboard Hub Diario (INSERIES-DASHBOARD-HOME-EXPERIENCE-02)

Evolucao do Dashboard Home (`/`) para um hub de uso diario — responde "o que aconteceu e o que devo fazer **hoje**", nao "tudo que existe no sistema". Construido sobre o enxugamento do sprint anterior (INSERIES-DASHBOARD-UX-AND-NAVIGATION-01).

**Principio central:** tres perguntas, seis secoes:
1. *Onde parei?* → Continuar assistindo (sempre)
2. *O que estreou enquanto eu estava fora?* → Lancados desde ultima visita (condicional)
3. *O que vem por ai?* → Proximos episodios (sempre + `EmptyState`)
4. *Estou atrasado em algo?* → Pendencias (condicional)
5. *O que estao fazendo?* → Atividade recente (sempre + `EmptyState`)
6. *Ir direto para X* → Atalhos rapidos (grid fixo)

**Fase 2 — Nova estrutura de secoes**

`DashboardHome` (`components/dashboard/dashboard-home.tsx`) reescrito: cai de 13+ fetches
para **3 chamadas em `Promise.all`**: `getDashboardCalendarData`, `getRecentActivityForUser`,
`getContinueWatchingForUser`. O prop do componente passa a exigir `lastLoginAt` (alem de
`id`/`name`) para calcular a janela "desde a ultima visita" (fallback: 24 h atras se null).

Secoes condicionals (`sinceLastVisit`, `overdue`) nao aparecem se vazias — sem estados
vazios desnecessarios no Dashboard. `Proximos episodios` e `Atividade recente` sempre
aparecem com `EmptyState` quando nao ha dados, para evitar um Dashboard em branco na
primeira vez de uso.

**Fase 3 — Recomendacoes removidas do Dashboard**

`Recomendado para voce` saiu do Dashboard completamente. O motor de recomendacoes
(`lib/recommendations/`) continua existindo e servindo `/recommendations` — apenas nao
aparece mais na Home. Os Atalhos rapidos dao acesso direto caso o usuario queira explorar.

**Fase 4 — Altura uniforme dos cards de Continuar assistindo**

`ContinueWatchingCard` ganhou `sm:h-60` no container externo e `overflow-hidden` no div
de conteudo — garante que todos os cards do carrossel horizontal tenham a mesma altura no
breakpoint desktop, independentemente de quantas linhas o titulo/episodio ocupa.
A animacao de hover foi mantida em `hover:-translate-y-1` (padrao do sprint anterior).

**Fase 5–11 — Grid, responsividade, acessibilidade**

Nenhuma classe `auto-fit`/`auto-fill` foi introduzida. O grid de Atalhos rapidos usa
`grid-cols-2 sm:grid-cols-3 lg:grid-cols-5` — colunas fixas por breakpoint, mesma regra
global. Todos os `<section>` tem `aria-label`, icones decorativos recebem `aria-hidden`,
links de "Ver tudo" sao `shrink-0` para nao quebrar em viewports estreitas. Validacao de
breakpoints por inspecao de classes Tailwind e HTTP direto (sem Playwright no sandbox).

**Data layer**

- `lib/calendar/queries.ts` exporta `getDashboardCalendarData(userId, lastVisitAt)`: retorna
  `{ sinceLastVisit, upcoming, overdue }` numa unica carga de `loadUserCalendarData` (sem
  query extra ao banco — mesmo conjunto de series ativas ja carregado, so filtrado em memoria).
- `lib/auth/server.ts`: `getCurrentUser` agora seleciona `lastLoginAt` (campo ja mantido
  pelo route de login, nunca escrito aqui).

**Smoke test**

- Atualizacao da verificacao de ordem das secoes: removeu `recomendado` do `sectionIndex`,
  nova descricao "Continuar assistindo -> Proximos episodios -> Atividade recente ->
  Atalhos rapidos".
- Check "Recomendado para voce no Dashboard" substituido por verificacao de que o Dashboard
  carrega sem erro mesmo quando ha recomendacoes disponiveis (feature nao regressa, so foi
  movida para pagina propria).
- `dashboardGridIndex` ja usava "Proximos episodios" (corrigido no sprint anterior).

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
- `npm run discovery:run`: roda o Discovery Engine (Trending/On The Air/Popular/Top Rated/Discover, ponderados, com blacklist e ranking) — ver secao "Discovery Engine" abaixo
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
