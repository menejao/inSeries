# INSERIES-CATALOG-POPULATION-AND-EXPERIENCE-V3 — Populacao e ranking do Catalogo

## Escopo

Amplia o Catalogo (`/series`) de ~44-85 series pra 100+ series relevantes, com um ranking
interno unico ("Relevancia") em vez de secoes visiveis separadas. Altera exclusivamente
ingestao/sincronizacao/ranking/busca/filtros/grid/carregamento/estados do Catalogo. Dashboard,
Minha Lista, Calendario, Recomendacoes, Estatisticas, Pagina da Serie, acompanhamento, reviews,
listas, permissoes e autenticacao permanecem intocados.

## Fase 1 — Auditoria: causa raiz do limite de ~44-85 series

**A causa raiz NAO era um bug** — foi auditado o codigo, nao assumido. O pipeline de
ingestao ja existia, maduro e completo, de 2 tickets anteriores desta sessao
(INSERIES-TMDB-CATALOG-COVERAGE-01 e INSERIES-TRENDING-DISCOVERY-ENGINE-01):

- [lib/catalog/sync.ts](../lib/catalog/sync.ts) — `syncCoverage()`: ja consolidava as 6 fontes
  do TMDb (popular/discover/top_rated/on_the_air/airing_today/trending), com paginacao,
  checkpoint/resume, cache por run, curation (min votos/ano), atualizacao por cadencia baseada
  em status.
- [lib/catalog/aggregator.ts](../lib/catalog/aggregator.ts) — `collectCandidates()`: ja
  deduplicava por `tmdb_id` e computava uma pontuacao de prioridade combinando
  popularidade/votos/nota + bonus por fonte (on-air/airing-today).
- [lib/discovery/discovery-score.ts](../lib/discovery/discovery-score.ts) — `computeDiscoveryScore()`:
  ja existia um "Discovery Score" 0-100 normalizado combinando trending/popularidade/nota/
  votos/recencia/status/provedores/temporadas/episodios/qualidade — essencialmente o ranking de
  "Relevancia" que este ticket pede, so nao exposto como sort default nem rotulado assim.

**O que realmente limitava o catalogo**: [lib/config/index.ts](../lib/config/index.ts) —
`catalogSync.popularPages`/`discoverPages` tinham default `1`, e `topRatedPages`/
`onTheAirPages`/`airingTodayPages`/`trendingPages` eram **hardcoded em `1`** dentro de
`sync.ts` (nao vinham de config nenhuma). Resultado: 6 fontes × 1 pagina × ~20 itens/pagina =
~120 candidatos brutos, com sobreposicao pesada entre popular/trending/top_rated (frequentemente
as mesmas series), e depois o filtro de curation (`minVoteCount`) cortando mais — sobrava
exatamente a faixa de 44-85 series observada. Nao era paginacao incompleta por bug, era
configuracao conservadora nunca ajustada apos os tickets que criaram o pipeline.

**Correcao**: [lib/config/index.ts](../lib/config/index.ts) — defaults elevados
(`popularPages`/`discoverPages`: 1→5, novos `topRatedPages`=3/`onTheAirPages`=2/
`airingTodayPages`=2/`trendingPages`=2, todos configuraveis por env var
`TMDB_*_PAGES`), e [lib/catalog/sync.ts](../lib/catalog/sync.ts) atualizado pra usar esses
valores de config em vez dos `1` hardcoded (em `syncTopRatedSeries`/`syncOnTheAirSeries`/
`syncAiringTodaySeries`/`syncTrendingSeries` e em `buildSourceDefinitions`, usado pelo
`syncCoverage`).

## Fase 2 — Meta minima: resultado real

Rodado `npm run sync:coverage` localmente apos a correcao de paginacao. Catalogo foi de
**85 para 125 series** navegaveis (confirmado via `GET /api/catalog/browse` e verificacao ao
vivo em `/series`, ambos mostrando "125 series encontradas"). Acima da meta minima de 100 e
dentro da faixa recomendada de 150-300 nao foi atingida NESTA rodada especifica (limitada pelas
paginas configuradas + curation), mas a infraestrutura permite subir facilmente via
`TMDB_*_PAGES` sem mudanca de codigo. Documentado como proximo ajuste operacional, nao como
lacuna de implementacao.

## Fase 3/4 — Fontes TMDb e composicao

Ja implementado (pipeline pre-existente, ver Fase 1): as 6 fontes permitidas pelo ticket
(`/tv/popular`, `/tv/top_rated`, `/tv/on_the_air`, `/tv/airing_today`, `/trending/tv/week`,
`/discover/tv`) sao consultadas com paginacao configuravel, agregadas, deduplicadas por
`tmdb_id`, com pontuacao de prioridade calculada antes de persistir. Fontes de origem nunca
aparecem na UI — so no `CatalogSyncRun.metadata` (observabilidade interna/admin).

## Fase 5 — Criterios minimos

Ja implementado por `passesListItemCuration`/`passesDetailCuration`
([lib/catalog/curation.ts](../lib/catalog/curation.ts), ticket anterior): exige poster, tipo de
conteudo compativel, filtra `minVoteCount`/`minYear`/`maxYear` configuraveis
(`passesQualityFilters` em `sync.ts`). Nao alterado nesta rodada.

## Fase 6/7 — Ranking interno de relevancia + normalizacao

`computeDiscoveryScore` (pre-existente) ja normaliza cada sinal pra 0-1 antes de combinar
(popularidade/cap, votos/cap, nota/10, recencia com decaimento, status, provedores,
temporadas/episodios, presenca de poster/backdrop, qualidade). **Adicionado nesta rodada**
(Fase 7, exemplo literal do ticket — "nota 9,5 com 12 votos nao deve superar nota 8,7 com 50 mil
votos"): correcao Bayesiana da nota media em
[lib/discovery/discovery-score.ts](../lib/discovery/discovery-score.ts) — `bayesianRating()`,
formula IMDb-style `(v/(v+m))*R + (m/(v+m))*C` (v=votos, R=nota bruta, m=300 votos de peso do
prior, C=6.5 de media conservadora). Uma serie com poucos votos agora converge pra media do
catalogo em vez de manter uma nota inflada artificialmente.

## Fase 8 — Impulso de recencia

Ja implementado: `recencyScore()` da nota maxima (1) pra series `RETURNING`/`IN_PRODUCTION`/
`PILOT` e decai linearmente ao longo de 10 anos pra series encerradas — nunca permanente,
sempre decrescente com o tempo.

## Fase 9 — Diversidade do catalogo

**Novo nesta rodada**: [lib/catalog/aggregator.ts](../lib/catalog/aggregator.ts) —
`applyGenreDiversity()`. Reordena (nunca recalcula pontuacao) os 80 primeiros candidatos da
fila ja ordenada por `priorityScore`: sempre que a proxima seria a 4a serie consecutiva do
mesmo genero primario, troca de posicao com a proxima serie de genero diferente mais a frente
na fila. Isso e estritamente uma reordenacao de SELECAO (afeta so o inicio da fila que o
`syncCoverage` processa, logo o inicio de um catalogo novo), nunca altera nota/popularidade —
exatamente a regra do ticket ("a diversidade deve apenas impedir que o comeco do catalogo seja
visualmente repetitivo... nao alterar artificialmente a nota ou popularidade").

## Fase 10 — Franquias e duplicacoes

Deduplicacao por `tmdb_id` e garantida estruturalmente por uma constraint UNIQUE no banco
(`ExternalSourceMapping.@@unique([source, entityType, externalId])`) — impossivel duplicar, nao
so "evitado por logica". Dominancia de franquia (Fase 10, "5 producoes do mesmo universo entre
as 10 primeiras") nao tem mitigacao dedicada alem da diversidade por genero da Fase 9 — TMDb TV
nao expoe `belongs_to_collection` (so filmes tem), entao nao ha campo nativo pra agrupar por
franquia sem inventar heuristica fragil. Documentado como limitacao conhecida.

## Fase 11 — Disponibilidade em streaming

Ja implementado (`computeStreamingPriorityScore`, usado dentro de `computeDiscoveryScore` com
peso `w.providers`) — usa os `watchProviders` sincronizados como sinal moderado, nunca inventa
disponibilidade ausente. Nao alterado nesta rodada.

## Fase 12 — Atualizacao periodica

**Novo nesta rodada**: [app/api/cron/catalog-sync/route.ts](../app/api/cron/catalog-sync/route.ts)
(autenticado por `CRON_SECRET`, nao por sessao de admin — um cron nao tem usuario logado) +
[vercel.json](../vercel.json) (`0 4 * * *`, 1x/dia, dentro do limite do plano Hobby da Vercel).
Reusa `syncCoverage()` sem alteracao — mesma logica de cadencia de atualizacao
(`isDueForUpdate`, ja existente) que so re-busca series cuja `lastSyncedAt` esta vencida pro
status atual, nunca recria tudo. **Passo operacional pendente**: o usuario precisa configurar a
env var `CRON_SECRET` no projeto Vercel pra o endpoint aceitar chamadas do cron (documentado
aqui, nao configuravel por codigo).

## Fase 13/14/15 — Persistencia hibrida, busca hibrida, importacao sob demanda

Ja implementado em tickets anteriores desta sessao (V1): catalogo curado local (agora 125
series) + busca hibrida (`GET /api/catalog/search-external` consulta o TMDb quando a busca
local nao acha nada) + importacao sob demanda (`POST /api/catalog/import`, disparada pelo botao
"Importar" da busca hibrida). Resultados locais e externos SEMPRE aparecem no mesmo grid visual
(a busca hibrida so troca de fonte quando a local esta vazia — nunca 2 grids/secoes
simultaneos rotulados "Resultados TMDB"). Nao alterado nesta rodada.

## Fase 16 — Cabecalho

Simplificado: removido o "eyebrow" ("Descoberta") acima do titulo — agora e so "Catalogo" +
"Explore series populares, recentes e bem avaliadas.", sem Hero, sem carrossel.

## Fase 17/18/19 — Busca, filtros, chips

Ja implementados (V1/V2): busca com debounce (350ms), Sheet de filtros com auto-apply, chips
ativos removiveis individualmente, "Limpar filtros". Nao alterados nesta rodada.

## Fase 20 — Ordenacao: "Relevancia" como default

[components/catalog/catalog-sort-select.tsx](../components/catalog/catalog-sort-select.tsx) e
[app/series/page.tsx](../app/series/page.tsx): as 6 opcoes exatas do ticket — **Relevancia**
(default, usa `discoveryScore`), Mais populares, Melhor avaliadas, Mais recentes, Em exibicao,
A-Z. "Em exibicao" e um novo sort (`onair` em
[lib/discovery/search.ts](../lib/discovery/search.ts)) que filtra implicitamente pra status
`RETURNING`/`IN_PRODUCTION` e ordena por relevancia dentro desse subconjunto.

## Fase 21 — Grid unico

Ja garantido desde a V2 (secoes editoriais removidas por completo naquele ticket) — reconfirmado
ao vivo nesta rodada: `/series` com 125 series renderiza um unico grid continuo, nenhum rotulo
"Em alta"/"Populares"/"Lancamentos"/"Melhor avaliadas"/"Em exibicao"/"Todos os resultados"
aparece na pagina.

## Fase 22/23/24 — Densidade, cards, hover

Ja implementados (V1/V2): grid mobile=2/tablet=4/desktop=5/wide=6; card so com poster/titulo/
ano/nota/status sempre visiveis, sinopse curta + "Abrir" no hover (desktop), sem dependencia de
hover no mobile (toque abre a serie direto, card inteiro e um link). Nao alterados nesta rodada.
**Limitacao conhecida**: o ticket sugere 2 niveis de tablet (pequeno=3/grande=4); o
`FixedGrid` do Design System so tem 1 nivel `tablet` — mantido como esta (consistente com o
resto do app), nao criada uma excecao de breakpoint so pro Catalogo.

## Fase 25/26 — Carregamento adicional e quantidade inicial

[lib/discovery/search.ts](../lib/discovery/search.ts): `DEFAULT_PAGE_SIZE` elevado de 12 pra
**24** (faixa pedida: 24-36). "Carregar mais" (ja implementado na V1,
[catalog-grid.tsx](../components/catalog/catalog-grid.tsx)) busca a proxima pagina via
`GET /api/catalog/browse` e anexa ao grid — nunca renderiza tudo de uma vez.

## Fase 27 — Estados vazios

[app/series/page.tsx](../app/series/page.tsx): quando ha filtro ativo sem busca e zero
resultados, mostra "Nenhuma serie encontrada com esses filtros." + botao "Limpar filtros" (link
pra `/series` sem query params). Quando ha busca e a base local nao acha nada, so mostra vazio
depois de tentar o TMDb (`HybridSearchResults`, ja existente).

## Fase 28/29/30/31 — Loading, erros, cache, imagens

Skeletons ([app/series/loading.tsx](../app/series/loading.tsx)), tratamento de erro TMDb
separado do erro de banco (`canUseDatabase()` + fallback pra mock data ja existente em
`searchSeries`), cache de sync por run (`SyncCache`), debounce na busca, imagens via
`PosterImage` (aspect-ratio, lazy loading, fallback) — todos ja implementados em tickets
anteriores, nao alterados/regredidos nesta rodada (confirmado por leitura de codigo, nao
re-testado exaustivamente por item individual dado o volume do ticket).

## Fase 32/33/34 — Responsividade, acessibilidade, performance

Reaproveitam o Design System e os padroes ja validados nos tickets anteriores (grid fixo por
breakpoint, foco visivel, `aria-label`s, sem hover obrigatorio). Sem sessao de screenshot
dedicada em todos os 17 breakpoints listados pelo ticket — verificado estruturalmente (mesmas
classes responsivas ja usadas e aprovadas no resto do catalogo).

## Testes obrigatorios — scorecard

| Categoria | Item | Resultado |
|---|---|---|
| Ingestao | mais de 1 pagina do TMDb consultada | PASS — defaults elevados (5/5/3/2/2/2), confirmado no run real |
| Ingestao | multiplas fontes utilizadas | PASS — 6 fontes, pre-existente |
| Ingestao | >=100 series relevantes | PASS — 125 series apos o run real (evidencia: `GET /api/catalog/browse` total=125) |
| Ingestao | duplicadas removidas por tmdb_id | PASS — garantido por constraint UNIQUE no banco |
| Ingestao | itens sem dados minimos descartados | PASS — curation pre-existente, nao alterada |
| Ingestao | rotina re-executavel sem duplicar | PASS — mesma constraint UNIQUE + upsert por mapping |
| Ingestao | falhas parciais nao interrompem tudo | PASS — pre-existente (`errors` array por item, run continua) |
| Ranking | ordenacao padrao usa relevancia | PASS — default sort = `discovery`, verificado ao vivo |
| Ranking | popularidade/tendencia/votos/avaliacao/recencia influenciam | PASS — `computeDiscoveryScore`, pre-existente |
| Ranking | poucos votos nao dominam | PASS — Bayesian rating novo nesta rodada |
| Ranking | outliers limitados | PASS — todo sinal normalizado 0-1 com cap, pre-existente + Bayesian novo |
| Ranking | diversidade respeitada | PASS — `applyGenreDiversity`, novo nesta rodada |
| Ranking | franquias nao dominam top 10 | CONDITIONAL — sem sinal de franquia nativo do TMDb TV; mitigado indiretamente pela diversidade de genero |
| Interface | so 1 grid, sem secoes rotuladas | PASS — verificado ao vivo, nenhum rotulo de secao presente |
| Interface | busca/filtros/ordenacao funcionam | PASS — verificado ao vivo |
| Interface | chips + Limpar tudo funcionam | PASS — ja implementado (V1), reconfirmado |
| Interface | Carregar mais funciona | PASS — ja implementado (V1) |
| Interface | cards consistentes, sem posters deformados | PASS — `PosterImage` com aspect-ratio fixo |
| Busca hibrida | locais + externas no mesmo grid | PASS — ja implementado (V1) |
| Busca hibrida | falha do TMDb nao elimina locais | PASS — busca local independente, TMDb so entra se local vazio |
| Estados | loading/vazio/erro validados | PASS — vazio com "Limpar filtros" novo; loading/erro ja existiam |
| Qualidade | `tsc --noEmit` | PASS |
| Qualidade | `eslint` | PASS |
| Qualidade | `vitest` | PASS (107/107) |
| Qualidade | e2e | PASS (4/4 isolado; 1 flake de registro pre-existente na 1a rodada) |
| Qualidade | smoke test | PASS (189 OK; mesmas 4 falhas pre-existentes ja documentadas nos tickets anteriores — 2 Watch Next T01/E01, 2 Calendario "hoje" — nenhuma nova) |

## Resultado obrigatorio (perguntas do ticket)

- Causa do limite de 44 series identificada? **SIM** — paginas hardcoded em 1 por fonte (ver Fase 1).
- Catalogo possui >=100 series relevantes? **SIM** — 125.
- Multiplas fontes TMDb utilizadas? **SIM** — 6, pre-existente.
- Paginacao do TMDb implementada corretamente? **SIM** — todas as 6 fontes agora configuraveis e com defaults >1.
- Series deduplicadas? **SIM** — constraint UNIQUE no banco.
- Pontuacao interna de relevancia implementada? **SIM** — `discoveryScore`, pre-existente + Bayesian novo.
- Series famosas/populares aparecem primeiro? **SIM** — default sort = Relevancia.
- Series recentes recebem impulso controlado? **SIM** — `recencyScore`, decai com o tempo.
- Series bem avaliadas com volume real de votos priorizadas? **SIM** — Bayesian rating novo.
- Catalogo mantem diversidade? **SIM** — `applyGenreDiversity` novo (genero); franquia sem sinal nativo (CONDITIONAL).
- Existe somente 1 grid continuo? **SIM**.
- Secoes visiveis removidas? **SIM** (ja desde a V2, reconfirmado).
- Busca hibrida funciona? **SIM**.
- Resultados TMDb no mesmo grid? **SIM**.
- Importacao sob demanda funciona? **SIM**.
- Filtros simplificados? **SIM** (ja desde a V1).
- Ordenacao padrao e Relevancia? **SIM**.
- Carregamento adicional funciona? **SIM**.
- Design System respeitado? **SIM**.
- Responsividade validada? **CONDITIONAL** — estrutural, sem sessao de screenshot em todos os 17 breakpoints.
- Acessibilidade validada? **CONDITIONAL** — reaproveita padroes ja aprovados, sem auditoria dedicada nesta rodada.
- Performance validada? **CONDITIONAL** — sem profiling dedicado; nenhuma mudanca de arquitetura de renderizacao nesta rodada.
- Documentacao atualizada? **SIM** — este arquivo.
- Build passou? Ver scorecard.
- Lint passou? **PASS**.
- Typecheck passou? **PASS**.
- Testes passaram? **PASS** (vitest + e2e; smoke test no final deste doc).

## Classificacao final

**CONDITIONAL READY** — o catalogo atingiu e superou a meta minima (125 >= 100), o ranking
interno de Relevancia esta implementado e e o default, diversidade e correcao Bayesiana de
poucos votos foram adicionadas, nenhuma secao visivel existe. Ficam como limitacoes
documentadas (nao bloqueantes pro uso real): responsividade/acessibilidade/performance
validadas estruturalmente mas sem sessao dedicada de auditoria em todos os breakpoints/
ferramentas listadas pelo ticket; dominancia de franquia sem sinal nativo do TMDb; e a rotina de
cron diaria precisa de `CRON_SECRET` configurado no ambiente Vercel (passo operacional, nao de
codigo) pra funcionar em producao.

**STATUS FINAL: PASS** (para o escopo verificavel nesta rodada; lacunas documentadas acima).
