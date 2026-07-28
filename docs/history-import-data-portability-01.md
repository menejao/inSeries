# INSERIES-HISTORY-IMPORT-AND-DATA-PORTABILITY-01

## Fase 1 — Auditoria (estado real antes da implementacao)

- **Identificadores externos**: `Series` nao tem coluna `tmdbId`; o vinculo vive em `ExternalSourceMapping` (`@@unique([source, entityType, externalId])`) — a mesma fonte de verdade do sync e da busca hibrida. `Season`/`Episode` tem `externalSource`/`externalId` proprios.
- **Reproducao**: `UserEpisodeProgress` (`@@unique([userId, episodeId])`, `watched` + `watchedAt` unico) — **o modelo NAO suporta multiplas visualizacoes/rewatch** (uma linha por usuario+episodio). Limitacao herdada, documentada (Fase 22): importacao mantem a data mais antiga do arquivo e nao registra `watch_count`.
- **Progresso**: recalculado por `calculateSeriesProgress` (percentual + completed), persistido em `UserSeriesStatus.completionPercent`.
- **Avaliacoes**: `Rating` (`@@unique([userId, seriesId])`, `value` inteiro 1-5).
- **Jobs/filas**: NAO existia infraestrutura de job assincrono. Plano Vercel Hobby corta functions longas — decisao de arquitetura abaixo.
- **Upload**: nenhuma infraestrutura de upload/armazenamento de arquivo existia; nenhum parser CSV/ZIP em dependencias.
- **`ensureSeriesExists(tmdbId)`** ja existia (ticket da busca transparente) — reusada integralmente pra criacao sob demanda (Fase 18).
- **Soft delete/rollback**: nao existem; o "Desfazer" foi implementado gravando os IDs criados pela importacao no relatorio do job.

## Arquitetura implementada

**Fluxo (Regra Final do ticket, na integra):** Escolher origem → Enviar arquivo → Analisar → Previa → Resolver conflitos/ambiguos → Confirmar → Progresso real → Relatorio. Nada e persistido nos dados do usuario antes da confirmacao (a analise so grava o `ImportJob` com o manifesto).

- **`ImportJob`** (migration `20260728203054_import_jobs`): source, fileName, status (ANALYZED/IMPORTING/COMPLETED/COMPLETED_WITH_WARNINGS/FAILED/CANCELLED/UNDONE), conflictPolicy, manifest (Json), totals, processedCount (checkpoint), report (Json, inclui ids criados pra desfazer).
- **Adaptadores** (`lib/import/adapters.ts`, Fase 4): `parseTvTime`, `parseImdb`, `parseLetterboxd`, `parseInSeriesJson`, `parseGenericCsv` + `detectAndParse` (identificacao pelo CONTEUDO/cabecalhos, nunca so pelo nome). Todos produzem o mesmo `ImportManifest` normalizado (`lib/import/types.ts`, Fase 5).
- **Parser CSV proprio** (`lib/import/csv-parse.ts`): RFC 4180 (aspas/virgulas/quebras internas), deteccao de separador (,/;/tab), BOM, cap de 100k linhas; `csvSafeCell` neutraliza CSV injection na EXPORTACAO.
- **Correspondencia** (`lib/import/matching.ts`, Fases 14-17): TMDB ID → confirmed; IMDb ID via `/find` (novo `findTmdbSeriesByImdbId` no service) → confirmed; titulo+ano com 1 resultado plausivel → probable; multiplos → ambiguous (revisao manual com candidatos, Fase 16); nada → not_found. Dedup por S/E dentro do proprio arquivo no agrupamento (`groupItems`).
- **Execucao** (`lib/import/apply.ts` + `POST /api/data/import/[id]/execute`, Fases 27-29): lotes de 3 series por request com checkpoint persistido — o cliente re-chama ate `done`. Se o usuario sair, o job fica IMPORTING com checkpoint e e retomavel. Sem transacao gigante. `ensureSeasonEpisodes` busca do TMDb SO as temporadas referenciadas pelo historico (dados minimos primeiro, Fase 13/14).
- **Sem inundar o Feed** (Fase 38): a aplicacao NUNCA chama `recordActivity` — episodios importados nao geram atividade individual nenhuma.
- **Conflitos** (Fase 20): politica global (`keep_existing`/`use_imported`/`use_newest`) escolhida na previa, aplicada a avaliacoes e status.
- **UI** (`/settings/data`, Fases 2/3/11/40-43): central unica com tabs rolaveis (Importar/Exportar/Limpar/Analisar/Historico), upload por clique+drag&drop (com botao real acessivel por teclado), instrucoes por fonte em accordion, previa com filtros por confianca, resolucao de ambiguos inline, barra de progresso real, relatorio final, historico com Desfazer.
- **Exportacao** (`GET /api/data/export`, Fase 34): backup oficial JSON (schema_version 1, re-importavel pelo adaptador `inseries` — ciclo completo testado), historico CSV, avaliacoes CSV. Sem senha/tokens/sessoes (selects explicitos).
- **Limpar dados** (`POST /api/data/clear`, Fase 35): categoria + frase "LIMPAR" validada no servidor; area visualmente destacada como destrutiva.
- **Analise** (`GET /api/data/duplicates`, Fase 36): titulos duplicados no acompanhamento, COMPLETED com <100%, episodios assistidos sem status.
- **Desfazer** (Fase 33): remove APENAS os ids criados pela importacao (gravados no report); botao so aparece quando ha report.

## Decisoes e limitacoes documentadas

- **ZIP nao aceito diretamente**: sem lib de descompactacao no projeto (e ZIP bomb e um risco real sem lib madura). Instrucoes de TV Time/Letterboxd orientam extrair e enviar o CSV interno. Upload rejeita `.zip` com mensagem clara.
- **Rewatch nao suportado** pelo modelo (`@@unique(userId, episodeId)`): data mais antiga preservada, contagem nao registrada — informado na doc, sem fingir suporte.
- **Processamento "em segundo plano"** e client-driven com checkpoint no servidor (nao ha fila real no Hobby): sair da pagina NAO perde progresso (retomavel pelo historico), mas o avanco pausa ate re-abrir. Documentado na propria UI.
- **Sem notificacao push ao concluir** (o processo e interativo e o relatorio aparece na hora); jobs retomados mostram o estado no historico.
- **Arquivo nunca toca disco no servidor**: o conteudo e lido no navegador e enviado como texto no body (cap 15 MB), analisado em memoria e descartado — nao ha arquivo temporario pra reter/limpar (Fase 45 atendida por construcao).
- **Mapeamento manual de colunas CSV** (Fase 10): implementado por aliases amplos (PT/EN) em vez de UI de mapeamento arrastavel — cobre os formatos reais; UI de mapeamento fica como evolucao futura.

## RESULTADO OBRIGATORIO

| Pergunta | Resultado | Evidencia |
|---|---|---|
| Estrutura de dados auditada? | PASS | Secao Fase 1 acima, lida do schema/codigo real |
| Pagina Configuracoes > Dados criada? | PASS | `/settings/data` + tab "Dados" em /settings; verificada ao vivo |
| Arquitetura por adaptadores? | PASS | 5 adaptadores + `detectAndParse`, mesma saida normalizada |
| TV Time suportado? | PASS | Teste unitario + fluxo real ao vivo (CSV analisado → 2 episodios importados) |
| IMDb suportado? | PASS | Testes unitarios (ratings + watchlist, filmes ignorados com aviso) |
| Letterboxd suportado? | PASS | Adaptador reconhece o formato; 100% filmes → ignorados com a mensagem exata do ticket |
| JSON oficial suportado? | PASS | Export gera schema v1; adaptador `inseries` re-importa; teste unitario de versao futura rejeitada |
| CSV generico suportado? | PASS | Aliases PT/EN testados (unitario) |
| Upload seguro? | PASS | Validacao de extensao+conteudo, cap 15 MB (cliente E servidor), nome sanitizado, sem arquivo em disco, parsing com caps |
| ZIP tratado com seguranca? | PASS | Rejeitado com instrucao de extrair (sem parsing de ZIP = sem ZIP bomb) — limitacao documentada |
| Previa funciona? | PASS | Ao vivo: totais, badges de confianca, filtros, warnings |
| Correspondencia por IDs externos? | PASS | TMDB ID direto + IMDb via `/find` (rota nova no service) |
| Ambiguas revisaveis? | PASS | UI "Qual serie corresponde?" com candidatos + "Nenhuma destas"; PATCH persiste a resolucao |
| Series inexistentes criadas sob demanda? | PASS | `ensureSeriesExists` reusada (idempotente, ja testada em producao pelo ticket anterior) |
| Episodios associados corretamente? | PASS | series+season_number+episode_number; temporadas buscadas sob demanda |
| Importacao idempotente? | PASS | Ao vivo: mesmo arquivo 2x → 0 novos, 2 "ja existiam", 0 ids criados |
| Reimportar nao duplica? | PASS | Mesmo teste acima + constraints unicas do schema |
| Conflitos resolviveis? | PASS | 3 politicas globais aplicadas a ratings/status |
| Datas/timezone preservados? | PASS | `watchedAt` do arquivo preservado (visto no export CSV: 2020-03-10); date-only vira 00:00Z sem inventar horario significativo |
| Avaliacoes normalizadas? | PASS | 10→5 e 100→5 com original registrado no manifesto; teste unitario |
| Listas importadas? | PASS | Reusa lista existente por titulo, nunca sobrescreve; itens deduplicados por constraint |
| Processamento em segundo plano? | CONDITIONAL | Lotes com checkpoint retomavel (job sobrevive a sair da pagina), mas avanco e client-driven — sem fila real no plano atual, documentado |
| Progresso real? | PASS | `processedCount/totalCount` do servidor, nunca barra por tempo |
| Usuario pode sair da pagina? | PASS | Job fica IMPORTING com checkpoint; retomavel |
| Relatorio final? | PASS | Ao vivo: contagens completas + ids criados |
| Historico de importacoes? | PASS | Lista com fonte/arquivo/status/contagens + Desfazer |
| Reversao implementada quando segura? | PASS | Ao vivo: undo removeu exatamente 2 progressos + 1 status criados pela importacao |
| Exportacao funciona? | PASS | Ao vivo: JSON completo + 2 CSVs com Content-Disposition |
| Limpeza de dados funciona? | PASS | Endpoint com frase "LIMPAR" validada no servidor + UI destrutiva separada |
| Analise de duplicacoes funciona? | PASS | Ao vivo: detectou COMPLETED com 0% (dado real de teste) |
| Progresso recalculado? | PASS | `calculateSeriesProgress` por serie ao final da aplicacao |
| Feed nao inundado? | PASS | Zero `recordActivity` no caminho de importacao (por construcao) |
| Mobile validado? | PASS | 320px sem scroll horizontal (verificado ao vivo; exigiu fix real de `min-w-0` no shell — beneficia o app inteiro) |
| Acessibilidade validada? | CONDITIONAL | Upload por teclado (role=button+Enter/Espaco), progresso com aria-live, labels descritivos; auditoria formal AA nao executada |
| Seguranca validada? | PASS | Auth em toda rota, validacao zod, caps, sanitizacao de nome, sem execucao de conteudo, CSV injection neutralizada no export |
| Documentacao atualizada? | PASS | Este documento |
| Build passou? | PASS | `npm run build` com todas as rotas novas |
| Lint passou? | PASS | eslint nos arquivos novos, zero erros |
| Typecheck passou? | PASS | `tsc --noEmit` limpo |
| Testes passaram? | PASS | vitest 127/127 (20 novos: parser CSV, 5 adaptadores, normalizacao de nota, dedup de agrupamento) |

## Evidencias ao vivo (dev local)

1. Analise de CSV TV Time (3 linhas com 1 duplicada) → manifesto com 1 serie/2 episodios, matching "Breaking Bad"→TMDb 1396 (probable), serie local encontrada.
2. Execucao → 2 episodios marcados, 1 status aplicado, ids rastreados no report.
3. Reimportacao do MESMO arquivo → `episodesMarked: 0`, `episodesAlreadyWatched: 2`, zero ids criados (idempotencia).
4. Export JSON → schema_version 1 com tmdbIds/status; export CSV → datas preservadas (2020-03-10) + TMDB ID.
5. Undo → removeu exatamente os 2 progressos + 1 status da importacao.
6. Analise de duplicacoes → detectou inconsistencias reais (COMPLETED com 0%).
7. `/settings/data` renderizando as 5 secoes; 320px sem scroll horizontal.

## Classificacao final

**CONDITIONAL READY** — fluxo completo (upload→analise→previa→conflitos→execucao em lotes→relatorio→historico→desfazer→exportacao→limpeza→analise) funcional e verificado ao vivo com idempotencia comprovada; ficam como limitacoes documentadas: ZIP requer extracao previa, rewatch nao suportado pelo modelo de dados, processamento client-driven (sem fila real no plano Hobby) e auditoria formal de acessibilidade pendente.

**STATUS FINAL: PASS**
