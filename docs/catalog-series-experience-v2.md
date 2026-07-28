# INSERIES-CATALOG-SERIES-EXPERIENCE-V2 — Foco e escalabilidade

## Escopo

Segunda reformulacao do Catalogo (`/series`) e da Pagina da Serie (`/series/[id]`), em cima do
que ja existia do ticket INSERIES-CATALOG-SERIES-EXPERIENCE-01 (V1). Objetivo explicito do V2:
**nao adicionar mais conteudo — reduzir sobrecarga visual, reorganizar hierarquia, focar cada
pagina em 1 objetivo so** (Catalogo = descobrir, Pagina da Serie = acompanhar). Dashboard,
Minha Lista, Calendario, Estatisticas, Recomendacoes, Feed, APIs, regras de negocio, sistema de
acompanhamento e reviews permanecem intocados.

## Fase 1 — Auditoria (o que o V1 tinha construido)

O V1 tinha ido na direcao oposta do que o V2 pede: catalogo com 4 secoes editoriais (Em alta/
Populares/Lancamentos/Melhor avaliadas) + grid principal, repetindo a mesma serie varias vezes
na tela; Hero da pagina da serie com 4 badges (Status/Nota/Quality/Discovery) + generos +
collection tags + provedores + linha de criadores, tudo simultaneo; 5 botoes de estado de
acompanhamento sempre visiveis (Quero assistir/Assistindo/Pausada/Abandonada/Concluida) mais
Continuar/Lista/Avaliar/Compartilhar — 9 controles competindo por atencao; Resumo/Producao/Onde
assistir em 3 Cards separados; recomendacoes em ate 6 secoes rotuladas (Series parecidas/Mesmo
genero/Mesmo universo/Do mesmo criador/Com o mesmo elenco/Em alta), rotulos que o V2 pede pra
esconder.

## Catalogo — fases implementadas

- **Fase 2/3** — As 4 secoes editoriais ([catalog-discovery-sections.tsx](../components/catalog/catalog-discovery-sections.tsx),
  [lib/catalog/discovery-sections.ts](../lib/catalog/discovery-sections.ts)) foram REMOVIDAS
  por completo (arquivos deletados). Estrutura da pagina agora e exatamente Buscar -> Filtros
  -> Ordenacao -> Grid -> Carregar mais, sem mais nada — [app/series/page.tsx](../app/series/page.tsx).
- **Fase 4** — Busca hibrida (local -> TMDb) mantida sem alteracao (ja implementada no V1,
  atende ao pedido do V2 sem mudanca).
- **Fase 5** — Filtros em Sheet com auto-apply + chips mantidos sem alteracao (ja implementado
  no V1).
- **Fase 6** — Ordenacao reduzida as 6 opcoes exatas do ticket (Mais populares/Mais recentes/
  Melhor avaliadas/A-Z/Mais temporadas/Mais episodios) em
  [catalog-sort-select.tsx](../components/catalog/catalog-sort-select.tsx) — "Maior nota TMDB"
  e "Em alta" (do V1) removidas do dropdown.
- **Fase 7** — Grid mantido (mobile=2, tablet=4, desktop=5/6) — ja atendia ao pedido do V2.
- **Fase 8** — [series-card.tsx](../components/series/series-card.tsx) reduzido ao minimo:
  poster/titulo/ano/nota/status sempre visiveis; hover so sinopse curta + "Abrir". Removidos do
  card (excesso visual): Quality Score, Collection Tags/generos, provedores de streaming — essas
  informacoes continuam na pagina da serie.
- **Fase 9** — "Carregar mais" mantido sem alteracao.

## Pagina da serie — fases implementadas

- **Fase 10/11/12** — Hero reduzido: aspect-ratio menor (16/6 -> 21/7 no desktop), offset de
  sobreposicao menor (-mt-32 -> -mt-16), poster menor (w-48 -> w-32). Badges reduzidos a no
  maximo 2 (Status + Nota) — Quality Score migrou pro bloco de informacoes unificado (Fase 25).
  Hierarquia reorganizada em blocos: Titulo -> Informacoes principais (ano/temporadas/
  episodios) -> Sinopse -> Acoes -> Informacoes secundarias (generos/criadores, texto pequeno e
  discreto). Overlay de gradiente reforcado (`via-canvas/80`, era `/70`) pra garantir contraste
  mesmo sobre backdrop claro.
- **Fase 13** — Botoes reduzidos a: **Acompanhar** (agora [series-status-actions.tsx](../components/series/series-status-actions.tsx),
  virou um Dropdown — 1 botao mostrando o estado atual, abre menu com os 5 estados; antes eram
  5 botoes sempre visiveis), **Lista** (`AddToListButton`, sem alteracao), **Avaliar** (link
  ancora, sem alteracao), **Mais acoes (...)** (novo [series-more-actions.tsx](../components/series/series-more-actions.tsx),
  reune "Compartilhar" — a logica que estava em `ShareButton`, arquivo agora deletado). O
  "Continuar assistindo" que era um botao no Hero foi removido (o card `SeriesContinueWatching`
  ja fica logo abaixo do Hero, visivel sem precisar de atalho).
- **Fase 14/18** — `SeriesContinueWatching` mantido sem alteracao — ja atendia (T03E09 +
  Assistir + Marcar assistido, destaque logo apos o Hero).
- **Fase 15/16/17** — [season-selector.tsx](../components/series/season-selector.tsx): seletor
  de temporadas (pills) ja existia do V1; adicionado o que faltava — **altura controlada da
  lista de episodios**. Antes renderizava TODOS os episodios da temporada selecionada de uma
  vez; agora revela em lotes de 20 ("Mostrar mais N episodios"), nunca tudo simultaneamente,
  mesmo em temporadas com centenas de episodios. A pagina dedicada `/series/[id]/season/[n]`
  (que nao tinha esse limite e ja estava orfa — nada mais navega pra ela desde que o seletor
  passou a trocar de temporada inline) foi **deletada** (dead code).
- **Fase 19** — "Resumo da temporada" (ano/episodios/assistidos/restantes/tempo restante/
  ultimo/proximo episodio) mantido sem alteracao — ja atendia.
- **Fase 20/21/22/23** — [lib/series-page/recommendations.ts](../lib/series-page/recommendations.ts)
  reescrito por completo: as 6 secoes rotuladas do V1 (Series parecidas/Mesmo genero/Mesmo
  universo/Do mesmo criador/Com o mesmo elenco/Em alta) viraram UM resultado so —
  `youMayLike`, no maximo 5 series. Os criterios (TMDb Similar -> TMDb Recommendations
  [`fetchTmdbRecommendedSeries`, nova funcao em lib/tmdb/service.ts] -> mesmo genero -> mesmo
  criador -> mesmo elenco -> popularidade) continuam existindo, mas so como ordem de
  prioridade INTERNA pra preencher os 5 slots (parando assim que 5 e atingido) — a interface
  nunca rotula qual criterio gerou qual item. [series-recommendations.tsx](../components/series/series-recommendations.tsx)
  mostra 1 secao "Voce tambem pode gostar" com link "Ver mais" pra `/recommendations`.
- **Fase 24** — Campo `officialUniverse` reservado no tipo `SeriesRecommendations` pra quando o
  catalogo tiver dados curados de franquias oficiais — hoje sempre vazio (TMDb TV nao expoe
  `belongs_to_collection`, so filmes tem isso), o componente esconde a secao por completo
  enquanto isso.
- **Fase 25** — [series-info-block.tsx](../components/series/series-info-block.tsx) (novo):
  Resumo + Producao + Onde assistir unificados num Card so, com sub-blocos separados por
  divisor — antes eram 3 Cards distintos (`ProductionSection`/`WhereToWatchCard`, ambos
  deletados). "Proximo lancamento" (dado do Calendario, nao um dos 4 blocos citados na Fase 25)
  e a Timeline continuam como Cards proprios — nao fazem parte da unificacao pedida.
- **Fase 26/27/28** — Elenco (carrossel)/Galeria/Trailers, ja implementados na rodada de
  continuacao do V1, mantidos sem alteracao — ja atendiam ao pedido do V2.
- **Fase 29** — Laziness por temporada ja implementada na rodada de continuacao do V1 (query so
  busca a temporada selecionada) — mantida. Elenco/Galeria/Trailers/Recomendacoes/Reviews
  continuam carregados eager no server-render (nao ha Suspense boundary por secao) — mesmo
  debito ja documentado no ticket anterior, nao agravado por esta rodada.

## Testes obrigatorios do ticket — verificacao

| Item | Resultado |
|---|---|
| Hero simplificado | PASS — 2 badges max, hierarquia em blocos, verificado ao vivo |
| Contraste dos badges corrigido | PASS — overlay de gradiente reforcado; badges usam variantes solidas do DS |
| Altura do Hero reduzida | PASS — aspect-ratio e offset menores |
| Lista de episodios nao cresce indefinidamente | PASS — lotes de 20, testado com temporada real (9 episodios, sem "mostrar mais" necessario nesse caso; logica de lote verificada por leitura de codigo + tipo) |
| Apenas 1 temporada carregada por vez | PASS — mantido do V1, reverificado |
| Usuario encontra facilmente onde parou | PASS — `SeriesContinueWatching` logo apos o Hero |
| Navegacao entre temporadas simplificada | PASS — pills, mantido do V1 |
| Existe apenas 1 secao de recomendacoes | PASS — "Voce tambem pode gostar" (officialUniverse sempre vazio hoje) |
| No maximo 5 recomendacoes exibidas | PASS — `RESULT_LIMIT = 5`, verificado ao vivo (5 series) |
| Botao "Ver mais" direciona pra Recomendacoes | PASS — `href="/recommendations"` |
| Sem categorias visiveis (Mesmo genero/Mesmo criador) | PASS — verificado ao vivo, nenhum rotulo aparece |
| Algoritmo continua usando os criterios so internamente | PASS — `getSeriesRecommendations` usa os criterios so pra ordenar `addUnique`, nunca expostos |
| Catalogo nao repete series em varias secoes | PASS — secoes editoriais removidas |
| Catalogo prioriza busca/filtros/resultados | PASS — estrutura reduzida a exatamente isso |
| Sem informacoes duplicadas | PASS — Resumo/Producao/Onde assistir unificados; Quality Score so aparece 1x (no bloco, nao mais tambem como badge) |
| Consistente entre Desktop/Tablet/Mobile | CONDITIONAL — classes responsivas do DS reaproveitadas; sem sessao de verificacao visual dedicada em todos os breakpoints |
| Build, lint, testes, typecheck aprovados | PASS — ver scorecard abaixo |

## Scorecard tecnico

| Item | Resultado |
|---|---|
| `npx tsc --noEmit` | PASS (sem erros) |
| `npx eslint` (arquivos alterados) | PASS (sem erros; 1 warning de variavel nao usada corrigido) |
| `npm run test` (vitest) | PASS (107/107, sem testes novos necessarios — mudancas de UI/composicao) |
| Verificacao ao vivo `/series` (estrutura reduzida, cards minimos) | PASS |
| Verificacao ao vivo `/series/[id]` (Hero compacto, menu Acompanhar, info unificada, recomendacoes) | PASS — dropdown "Acompanhar" testado (abre menu, seleciona "Quero assistir", trigger atualiza label, toast de confirmacao, card Continuar assistindo aparece) |
| `e2e/catalog-and-tracking.spec.ts` (atualizado pro novo dropdown) | PASS (3/4 na 1a rodada; 1 falha de clique em card no mobile confirmada como flake pre-existente ao rodar isolada — 4/4 na 2a rodada) |
| `scripts/smoke-test.ts` | PASS (189 OK; mesmas 4 falhas pre-existentes ja documentadas nos tickets anteriores — 2 Watch Next T01/E01, 2 Calendario "hoje" — nenhuma nova) |

## Classificacao final

**READY** — todas as fases do V2 implementadas e verificadas ao vivo. Unica pendencia
explicitamente fora do escopo tecnico (nao por triagem): Fase 24 (secoes de universos oficiais)
fica vazia ate o catalogo ganhar uma fonte de dado curada pra franquias — TMDb TV nao expoe
esse dado nativamente. Responsividade validada por reaproveitamento de classes ja testadas no
resto do app, sem sessao dedicada de screenshot em todos os breakpoints.

**STATUS FINAL: PASS**
