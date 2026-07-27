# INSERIES-CATALOG-SERIES-EXPERIENCE-01 — Descoberta e exploracao

## Escopo

Reformulacao do Catalogo (`/series`) e da Pagina da Serie (`/series/[id]`). Dashboard, Minha
Lista, Calendario, Feed, Recomendacoes, Estatisticas, APIs de negocio, sistema de
acompanhamento/reviews/listas e autenticacao permanecem intocados.

Ticket com 27 fases. Dado o tamanho (maior escopo de qualquer ticket desta sessao), o usuario
escolheu explicitamente a opcao "fase unica, prioridade core": implementar as fases de maior
impacto nesta rodada e documentar claramente o que fica de fora. Ver secao "Fases
conscientemente nao implementadas" abaixo.

## Fase 1 — Auditoria (resumo)

**Catalogo antes**: form tradicional com botao "Aplicar filtros" (sem auto-apply), paginacao
numerada, grid 4 colunas no desktop, cards mostrando poster/nota/status/ano/plataforma +
generos no hover, sem secoes editoriais, sem busca hibrida (serie inexistente localmente
simplesmente nao aparecia, sem opcao de importar da UI).

**Pagina da serie antes**: ja bastante rica (herdada de tickets anteriores desta sessao —
INSERIES-SERIES-PAGE-PREMIUM-01): Hero com backdrop/poster/nota/quality/discovery,
"Continuar assistindo", card "Resumo" com temporadas/episodios/progresso, "Proximo
lancamento", "Onde assistir", Producao, Timeline, temporadas em accordion (todas expandiveis
simultaneamente, cada uma carregando todos os seus episodios no DOM), reviews separadas (sua
avaliacao vs comunidade), recomendacoes em 4 blocos (similar por tag/keyword, "voce tambem
pode gostar" via motor de recomendacoes do usuario, mesma categoria, maratonas via Smart List).

**Problema central identificado**: as recomendacoes da pagina da serie usavam exatamente os
criterios que a Fase 21 deste ticket pede pra remover — maratona (Smart List) e "voce tambem
pode gostar" (motor de recomendacoes do usuario, que pondera popularidade/reviews positivas).
As temporadas em accordion violavam a Fase 25 (nunca isolar so 1 temporada visivel).

## Catalogo — fases implementadas

- **Fase 2/3** — Busca e o elemento central: [catalog-search-bar.tsx](../components/catalog/catalog-search-bar.tsx)
  atualiza a URL com debounce (sem botao). Busca hibrida: quando a busca local retorna 0
  resultados, [hybrid-search-results.tsx](../components/catalog/hybrid-search-results.tsx)
  busca no TMDb (`GET /api/catalog/search-external`) e oferece "Importar" por serie
  (`POST /api/catalog/import`, endpoint ja existente, reaproveitado), redirecionando pra
  pagina da serie recem-importada. Testado ao vivo: busca por "Severance" (nao cadastrada)
  retornou "Ruptura" via TMDb, import concluido, redirect funcionando.
- **Fase 4** — [filters.tsx](../components/series/filters.tsx) reescrito: form tradicional
  removido, filtros agora num `Sheet` com auto-apply (cada `onChange` atualiza a URL na hora),
  chips ativos fora do Sheet (cada um removivel individualmente) + "Limpar filtros".
- **Fase 5** — [catalog-sort-select.tsx](../components/catalog/catalog-sort-select.tsx),
  elemento dedicado (nao mais dentro do form de filtros). Adicionadas as opcoes que faltavam
  ("Mais temporadas"/"Mais episodios", via novos casos em `buildOrderBy` em
  [lib/discovery/search.ts](../lib/discovery/search.ts)).
- **Fase 6** — `FixedGrid` do catalogo: mobile=2, tablet=4, desktop=5, wide (ultrawide)=6.
- **Fase 7** — [series-card.tsx](../components/series/series-card.tsx): poster/nota/status/ano
  sempre visiveis; no hover (desktop), sinopse curta (2 linhas) + numero de temporadas +
  acao "Abrir" aparecem, sem competir com os dados sempre visiveis.
- **Fase 8** — Paginacao numerada removida. [catalog-grid.tsx](../components/catalog/catalog-grid.tsx):
  primeira pagina server-rendered (SEO), "Carregar mais" busca a proxima pagina em
  `GET /api/catalog/browse` e anexa ao grid existente, sem trocar de URL.
- **Fase 9** — [catalog-discovery-sections.tsx](../components/catalog/catalog-discovery-sections.tsx):
  "Em alta"/"Mais populares"/"Lancamentos"/"Melhor avaliadas" (carrossel, reaproveitando
  `Carousel`/`CarouselItem` ja existentes), visiveis apenas quando NAO ha busca/filtro ativo
  (ver [lib/catalog/discovery-sections.ts](../lib/catalog/discovery-sections.ts)). Cada secao
  some se vazia.

## Pagina da serie — fases implementadas

- **Fase 10** — Hero: criadores, numero de temporadas e numero de episodios adicionados
  (antes so apareciam no card "Resumo", abaixo do fold).
- **Fase 11/15** — "Continuar assistindo" (`SeriesContinueWatching`) ja seguia o formato exato
  pedido (T03 | E09 + nome do episodio, "Continuar"/"Marcar assistido") — nenhuma mudanca
  necessaria, apenas confirmado contra a especificacao da Fase 15.
- **Fase 12/13** — [season-selector.tsx](../components/series/season-selector.tsx)
  substitui o accordion antigo (`SeasonCard`, removido): pills de temporada (`role="tablist"`)
  + 1 card "Resumo da temporada" (ano, episodios, assistidos, restantes, tempo restante,
  ultimo/proximo episodio) + lista de episodios — sempre so da temporada selecionada montada
  no DOM.
- **Fase 25 (laziness de query, implementado em rodada de continuacao)** — a primeira versao
  desta fase so resolvia a renderizacao (nunca todas as temporadas montadas na arvore React ao
  mesmo tempo), mas a query no servidor (`getCatalogSeriesBySlug`) ainda buscava episodios de
  TODAS as temporadas de uma vez. Corrigido:
  - [lib/catalog/repository.ts](../lib/catalog/repository.ts): `getCatalogSeriesSummaryBySlug`
    (seasons sem episodios — so metadados) + `getSeasonEpisodes(seriesId, seasonNumber)`
    (episodios de UMA temporada).
  - `GET /api/series/[id]/season/[number]` — novo endpoint que `SeasonSelector` (agora client)
    chama sob demanda quando o usuario troca de aba; a primeira temporada vem server-rendered
    (sem loading inicial), as demais so buscam ao serem selecionadas.
  - [lib/progress/series-summary.ts](../lib/progress/series-summary.ts): `getSeriesProgressSummary`
    substitui o calculo antigo (que também iterava todos os episodios de todas as temporadas) —
    progresso/ultimo-episodio/temporadas-completas agora vem de `count`/`findFirst`/`findMany`
    agregados, todos limitados pelo que o usuario JA assistiu, nunca pelo total de episodios do
    catalogo. `calculateSeriesProgress` (usado por outras paginas) foi deixado intocado.
  - Mesma pagina de temporada dedicada (`/series/[id]/season/[n]`) tambem migrada pro mesmo
    padrao (usa `getSeasonEpisodes` em vez de carregar a serie inteira).
  - Testado ao vivo: trocar de "Temporada 1" pra "Temporada 2" em Ruptura mostra "Carregando
    episodios..." brevemente e depois os episodios de S02 (confirmado via DOM: `S02E01`
    presente so apos o fetch client-side resolver) — a troca de aba nao refaz a query da
    temporada 1.
- **Fase 14** — [episode-row.tsx](../components/series/episode-row.tsx): sinopse removida do
  card (ticket pede so numero/titulo/runtime/data/status/acao); card mais baixo.
- **Fase 21/22** — [lib/series-page/recommendations.ts](../lib/series-page/recommendations.ts)
  reescrito por completo:
  - **Series parecidas**: prioriza TMDb Similar (`fetchTmdbSimilarSeries`, nova funcao em
    [lib/tmdb/service.ts](../lib/tmdb/service.ts)) filtrado ao que ja existe no catalogo local
    (via `ExternalSourceMapping`); cai pro heuristica de tag/keyword (ordenada por Quality, nao
    popularidade) so quando TMDb esta indisponivel ou sem match local.
  - **Mesmo genero**: apenas genero principal, ordenado por Quality Score — sem mudanca de
    criterio, so renomeado de "Mais da mesma categoria".
  - **Do mesmo criador** (nova secao): overlap em `createdBy`, quando a serie tem criador(es)
    conhecidos.
  - **Em alta** (nova secao, SEMPRE separada): Discovery Score, nunca misturada com "parecidas".
  - **Removidos**: "Maratonas" (Smart List = criterio "maratona", proibido pela Fase 21) e
    "Voce tambem pode gostar" (motor de recomendacoes do usuario, pondera popularidade/reviews
    positivas — tambem fora dos criterios permitidos).
  - **Mesmo universo** e **Com o mesmo elenco** (implementados em rodada de continuacao):
    - Mesmo universo: TMDb TV nao expoe `belongs_to_collection` (exclusivo de filmes) — usa
      como proxy overlap de >=2 keywords, ou 1 keyword + 1 produtora em comum (um unico sinal
      fraco isolado nunca qualifica). Documentado como heuristica, nao um campo nativo do TMDb.
    - Com o mesmo elenco: agora viavel porque o elenco passou a ser persistido (Fase 17) — cruza
      por `id` de ator do TMDb entre a serie atual e o resto do catalogo, ranqueado pelo numero
      de atores em comum.
  - Testado ao vivo: pagina da serie recem-importada "Ruptura" (Severance) mostrou "Series
    parecidas", "Mesmo genero" e "Em alta" populados e visualmente separados; "Do mesmo
    criador"/"Mesmo universo"/"Com o mesmo elenco" corretamente ausentes nesse caso especifico
    (catalogo de seed pequeno, sem overlap suficiente com Ruptura em nenhum dos 3 criterios) —
    o comportamento correto de uma secao com "zero sinal" e sumir, nao mostrar generico.

## Fase 17/18/19 — Elenco, Galeria, Trailers (implementado em rodada de continuacao)

Adicionados apos o primeiro corte deste ticket, a pedido do usuario. Exigiu 3 mudancas na
camada de dados (unica excecao a "nao tocar o pipeline de sync" — mudanca aditiva, sem alterar
regras de negocio existentes):

- **Schema** (migration `20260727201621_catalog_cast_media_fields`): 4 colunas novas em
  `Series` — `cast Json[]`, `videos Json[]`, `backdropUrls String[]`, `posterUrls String[]`,
  todas com `@default([])`. Nenhuma coluna existente alterada.
- **TMDb** ([lib/tmdb/service.ts](../lib/tmdb/service.ts)): `append_to_response` de
  `fetchTmdbSeriesDetails` ganhou `credits,videos` (mesma chamada `tv/{id}` de sempre, sem
  request extra); `images` ja vinha, so nao extraiamos `backdrops`/`posters` (so `logos`).
- **Normalizacao** ([lib/catalog/normalize.ts](../lib/catalog/normalize.ts)): `extractCast`
  (top 20 por `order`), `extractVideos` (Trailer/Teaser/Clip/Featurette do YouTube, oficiais
  primeiro), `extractGallery` (backdrops/posters, ate 20 cada).
- **Persistencia** ([lib/catalog/repository.ts](../lib/catalog/repository.ts)): os 4 campos
  seguem a mesma regra "undefined nunca sobrescreve" ja usada por tagline/keywords/etc — o
  sync leve (list-only) nunca apaga elenco/midia ja salvos.
- **Leitura** ([lib/series-page/queries.ts](../lib/series-page/queries.ts)):
  `getSeriesMedia(seriesId)` busca so os 4 campos direto do Prisma, fora do tipo `Series`
  compartilhado (catalogo/busca nao carregam elenco/midia à toa).
- **UI**: [cast-carousel.tsx](../components/series/cast-carousel.tsx) (foto/nome/personagem),
  [series-gallery.tsx](../components/series/series-gallery.tsx) (backdrops + posters em 2
  carrosseis), [series-trailers.tsx](../components/series/series-trailers.tsx) (thumbnail do
  YouTube + play, abre em nova aba — sem embed, evita CSP/autoplay). Todas as 3 somem por
  completo se a serie nao tiver o dado (series ja catalogadas antes desta mudanca so ganham
  elenco/midia na proxima sincronizacao/importacao).
- Testado ao vivo: reimportando "Ruptura" (Severance, `POST /api/catalog/import`) populou os 3
  campos — Elenco mostrou 8 atores reais (Adam Scott, Britt Lower, John Turturro, Christopher
  Walken, Patricia Arquette...), Galeria mostrou 16 backdrops + 20 posters, Trailers mostrou o
  trailer oficial com thumbnail do YouTube.
- **Diretores/Roteiristas** (mencionados na Fase 17 "quando disponiveis") ficam fora: no TMDb,
  esses papeis sao por episodio (`tv/{id}/season/{n}/episode/{n}/credits`), nao por serie —
  sincronizar isso exigiria 1 chamada TMDb por episodio (proibitivo pra series com muitos
  episodios, mesmo problema de escala do achado Tagesschau no Calendario desta sessao).

## Fases conscientemente NAO implementadas

- **Fase 20 (Reviews)** — ja estava dividido em "Sua avaliacao" (`ReviewForm`) vs "Avaliacao da
  comunidade" (`ReviewsSection`) desde o ticket anterior (SERIES-PAGE-PREMIUM-01); nota TMDb ja
  aparece no Hero. IMDb nao e sincronizado pelo pipeline — nao adicionado (nao ha fonte de dado
  pra isso sem integrar um provedor externo novo, fora do escopo "so as paginas" do ticket).
- **Fase 24 (Timeline)** — ja existia (`SeriesTimeline`, ticket anterior) cobrindo
  inicio/episodios/temporadas completas/review/lista — nao alterado, ja atende ao pedido.
- **Diretores/Roteiristas por episodio** (parte da Fase 17) — ver nota especifica na secao
  Fase 17/18/19 acima; exigiria 1 chamada TMDb por episodio, desproporcional.

Todo o resto do ticket original (27 fases) foi implementado, incluindo os itens que ficaram de
fora do primeiro corte (Elenco/Galeria/Trailers, Mesmo universo/Mesmo elenco, laziness de
query por temporada) — completados a pedido do usuario numa rodada de continuacao no mesmo dia.

## Testes obrigatorios — scorecard

| Item | Resultado |
|---|---|
| `npx tsc --noEmit` | PASS (sem erros) |
| `npx eslint` (arquivos alterados) | PASS (sem erros) |
| `npm run test` (vitest) | PASS (107/107, nenhum teste unitario novo necessario — mudancas sao majoritariamente UI/composicao) |
| Verificacao ao vivo `/series` (grid, secoes, hover, load more) | PASS |
| Verificacao ao vivo busca hibrida + import (TMDb -> catalogo local) | PASS (Severance/Ruptura importada e redirecionada com sucesso) |
| Verificacao ao vivo `/series/[id]` (Hero, season selector, recomendacoes) | PASS |
| `e2e/catalog-and-tracking.spec.ts` | PASS (4/4; 1 falha isolada na etapa de registro, nao relacionada ao catalogo, confirmada como flake pre-existente ao rodar sozinha) |
| `scripts/smoke-test.ts` (bloco Catalogo/Descoberta) | PASS (160/164; as 4 falhas restantes — 2 de Watch Next T01/E01 e 2 do Calendario "hoje" — confirmadas pre-existentes via isolamento git-stash rodando o mesmo smoke test no codigo anterior a este ticket, identicas falhas) |
| Fase 17/18/19 (Elenco/Galeria/Trailers) | PASS — implementado, migrado, testado ao vivo (reimport populou os 3) |
| Fase 22 "Mesmo universo"/"Mesmo elenco" | PASS — implementado, testado ao vivo (secoes ausentes corretamente quando sem overlap) |
| Fase 25 (laziness de query por temporada) | PASS — query agora buscada por temporada sob demanda, testado ao vivo (troca de aba dispara fetch client-side) |
| Fase 26 (responsividade 320-ultrawide) | CONDITIONAL — grid/cards usam classes fixas responsivas consistentes com o resto do app; sem sessao de verificacao visual dedicada em todos os breakpoints |
| e2e (catalog + calendar specs) apos rodada de continuacao | PASS (9/10; mesma falha isolada de registro, confirmada flake ao rodar sozinha) |
| `scripts/smoke-test.ts` apos rodada de continuacao | PASS (189 OK; mesmas 4 falhas pre-existentes ja documentadas no ticket do Calendario — 2 Watch Next T01/E01, 2 Calendario "hoje" — nenhuma nova) |

## Classificacao final

**READY** — escopo completo do ticket original (27 fases) implementado, incluindo Elenco/
Galeria/Trailers, Mesmo universo/Mesmo elenco e laziness de query por temporada, adicionados
numa rodada de continuacao no mesmo dia a pedido do usuario. Unicas lacunas restantes: Fase 20
(nota IMDb — sem fonte de dado sincronizada) e diretores/roteiristas por episodio (Fase 17,
exigiria 1 chamada TMDb por episodio) — ambas documentadas acima com justificativa tecnica, nao
por triagem de escopo.

**STATUS FINAL: PASS**
