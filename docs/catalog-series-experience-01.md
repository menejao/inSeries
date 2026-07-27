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
- **Fase 12/13/25** — [season-selector.tsx](../components/series/season-selector.tsx)
  substitui o accordion antigo (`SeasonCard`, removido): pills de temporada (`role="tablist"`)
  + 1 card "Resumo da temporada" (ano, episodios, assistidos, restantes, tempo restante,
  ultimo/proximo episodio) + lista de episodios — sempre so da temporada selecionada montada
  no DOM. **Limite conhecido**: os dados de todas as temporadas (episodios inclusos) ainda sao
  buscados de uma vez no server (mesma query que ja existia antes deste ticket,
  `getCatalogSeriesBySlug`) — a melhoria aqui e apenas de renderizacao (nunca todas
  simultaneamente na arvore React), nao de query. Uma laziness real no nivel de banco (buscar
  so a temporada selecionada) ficaria pro Fase 20 de performance, nao feita nesta rodada —
  mesmo padrao de honestidade usado no achado do Calendario (Tagesschau) nesta sessao.
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
  - Testado ao vivo: pagina da serie recem-importada "Ruptura" (Severance) mostrou "Series
    parecidas", "Mesmo genero" e "Em alta" populados e visualmente separados; "Do mesmo
    criador" corretamente ausente (Dan Erickson sem outras series no catalogo local).

## Fases conscientemente NAO implementadas

- **Fase 17/18/19** (Elenco, Galeria, Trailers) — dependem de dados TMDb (`credits`,
  `images.backdrops/posters`, `videos`) que o pipeline de sync atual nao persiste. Adicionar
  exigiria mudar `lib/catalog/normalize.ts`/schema do Prisma para armazenar elenco/midia, fora
  do escopo de "so a pagina da serie" (tocaria o pipeline de sync, que o ticket pede pra nao
  alterar business rules). Fica como ticket de continuacao.
- **"Mesmo universo"** (parte da Fase 22, spin-offs/sequencias/universo compartilhado) — TMDb
  expoe isso via `belongs_to_collection`, nao sincronizado atualmente. Mesma razao acima.
- **"Mesmo elenco"** (parte da Fase 22) — precisa de dados de elenco (ver Fase 17 acima).
- **Fase 20 (Reviews)** — ja estava dividido em "Sua avaliacao" (`ReviewForm`) vs "Avaliacao da
  comunidade" (`ReviewsSection`) desde o ticket anterior (SERIES-PAGE-PREMIUM-01); nota TMDb ja
  aparece no Hero. IMDb nao e sincronizado pelo pipeline — nao adicionado.
- **Fase 24 (Timeline)** — ja existia (`SeriesTimeline`, ticket anterior) cobrindo
  inicio/episodios/temporadas completas/review/lista — nao alterado, ja atende ao pedido.
- **Fase 25 (laziness de query)** — ver nota no item "Season selector" acima: melhoria de
  renderizacao feita, melhoria de query (buscar so a temporada selecionada no banco) nao.

Essas lacunas devem ser comunicadas ao usuario e podem virar um ticket de continuacao.

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
| Fase 17/18/19 (Elenco/Galeria/Trailers) | NOT APPLICABLE — dados TMDb nao sincronizados, fora do escopo desta rodada |
| Fase 22 "Mesmo universo"/"Mesmo elenco" | NOT APPLICABLE — mesma razao acima |
| Fase 25 (laziness de query por temporada) | CONDITIONAL — melhoria de renderizacao feita; melhoria de query nao |
| Fase 26 (responsividade 320-ultrawide) | CONDITIONAL — grid/cards usam classes fixas responsivas consistentes com o resto do app; sem sessao de verificacao visual dedicada em todos os breakpoints |

## Classificacao final

**CONDITIONAL READY** — nucleo obrigatorio implementado e verificado ao vivo (busca hibrida +
import, filtros, ordenacao, grid, secoes editoriais, season selector, nova hierarquia de
recomendacoes). Elenco/galeria/trailers/mesmo universo/mesmo elenco ficam fora por dependerem
de dados que o pipeline de sync ainda nao persiste (mudanca maior, fora do escopo "so as
paginas" pedido pelo ticket). Laziness de query por temporada (Fase 25) fica como debito.

**STATUS FINAL: PASS** (para o escopo implementado; lacunas documentadas acima).
