# Migrações de banco de dados — guia de segurança

Este documento existe por causa de um incidente real: em 2026-07-31, um `prisma migrate dev`
rodado sem terminal interativo (sem TTY) detectou drift de schema, imprimiu um prompt de
confirmação de reset ("We need to reset the public schema...") e — por rodar sem stdin
interativo — esse prompt parece ter sido confirmado silenciosamente, apagando todos os dados do
banco de desenvolvimento. Os dados foram restaurados de um backup manual feito minutos antes.
As proteções abaixo existem para que isso não dependa de sorte/backup manual de novo.

## Banco principal, `directUrl` e shadow database

- **`DATABASE_URL`** — conexão principal, pooled (PgBouncer em produção/Neon). É o banco real
  usado pela aplicação e onde os dados moram.
- **`DATABASE_URL_UNPOOLED` (`directUrl`)** — mesma base de dados que `DATABASE_URL`, mas sem
  pooler. Necessária porque `prisma migrate deploy` usa advisory locks que o PgBouncer (modo
  transaction) não suporta. Em dev local, aponta pro mesmo Postgres (não há pooler no sandbox).
- **`SHADOW_DATABASE_URL`** — banco **separado e descartável** (`inseries_shadow` localmente),
  usado exclusivamente pelo Prisma para calcular diffs de migração (`migrate dev`, `migrate
  diff`). O Prisma recria e derruba esse banco livremente durante o cálculo do diff.

### Por que o shadow nunca pode apontar para o banco principal

Se `SHADOW_DATABASE_URL` == `DATABASE_URL` (mesmo host/porta/banco/schema), o Prisma perde o
lugar seguro onde testar mudanças. Quando ele detecta drift entre o histórico de migrações e o
estado real do banco, a única forma de resolver fica sendo resetar o **banco real** — e é
exatamente esse prompt de reset que, sem TTY, pode ser confirmado sem intervenção humana. Um
shadow database de verdade elimina essa classe de incidente inteira: o diff é sempre calculado
num banco descartável, nunca no de dev.

O guard (`scripts/db-guard/`) bloqueia qualquer comando se `DATABASE_URL` e
`SHADOW_DATABASE_URL` resolverem para o mesmo host+porta+banco+schema.

## Quando usar `migrate dev` vs `migrate deploy`

- **`migrate dev`** (via `npm run db:migrate:create`) — só para criar uma **nova** migração a
  partir de mudanças no `schema.prisma`, em ambiente de desenvolvimento local, rodado
  manualmente num terminal real (TTY). Sempre com `--create-only` — nunca aplica sozinho, só
  gera o arquivo `.sql` para revisão. O guard recusa rodar isso sem TTY ou fora de
  `DB_ENVIRONMENT=development`.
- **`migrate deploy`** (via `npm run db:migrate:deploy`) — aplica migrações **já existentes e
  revisadas** na pasta `prisma/migrations/`. Não faz diff, não pede confirmação, não reseta
  nada — só roda os `.sql` pendentes em ordem. É o comando correto para aplicar uma migração
  gerada e revisada, tanto localmente quanto em CI/produção. O guard sempre roda um backup antes.

Fluxo correto para uma mudança de schema nova:
1. Editar `prisma/schema.prisma`.
2. `npm run db:migrate:check` — só compara (`migrate diff`), nunca aplica.
3. `npm run db:migrate:create -- --name minha_mudanca` — gera o `.sql`, roda manualmente num
   terminal interativo.
4. Revisar o `.sql` gerado a olho (procurar `DROP`/`TRUNCATE` inesperado).
5. `npm run db:migrate:deploy` — aplica a migração revisada (com backup automático antes).

## Backup e restauração

- `npm run db:backup` — roda `pg_dump -U inseries -d <db> -F c` dentro do container Docker,
  copia o `.dump` pra `backups/<db>_<timestamp>.dump` (fora do controle de versão — `backups/`
  está no `.gitignore`), mantém só os 10 mais recentes.
- `db:migrate:create` e `db:migrate:deploy` chamam o backup automaticamente antes de rodar o
  Prisma. Se o backup falhar por qualquer motivo, o comando Prisma **não roda**.
- Restauração manual (dados apenas, sem tocar em schema/`_prisma_migrations`):
  ```bash
  docker cp backups/<arquivo>.dump inseries-postgres:/tmp/restore.dump
  docker exec inseries-postgres pg_restore -U inseries -d inseries --data-only --disable-triggers /tmp/restore.dump
  ```
  Sempre `--data-only`, nunca `--clean`/`--create` num banco que já tem a estrutura certa —
  essas flags recriam objetos e podem conflitar com migrações aplicadas depois do backup.

## Comandos proibidos para agentes/automação

Nunca rodar diretamente (sempre passar pelos wrappers `db:migrate:*`):
- `prisma migrate dev` sem `--create-only`
- `prisma migrate reset`
- `prisma db push`
- `prisma migrate resolve` em lote sem revisão humana linha a linha
- `prisma db execute` com SQL de escrita
- qualquer comando com `--force-reset` ou `--accept-data-loss`

O guard (`scripts/db-guard/guard.ts`) bloqueia estruturalmente reset/push/force-reset/accept-
data-loss a menos que `ALLOW_DESTRUCTIVE_MIGRATION=1` seja definido manualmente por um humano —
nunca definir essa variável em script de automação/CI de agente.

## Procedimento de recuperação em caso de drift

1. **Não rodar `migrate dev` nem `migrate reset` para "resolver" o drift.**
2. Rodar `npm run db:migrate:check` (usa `migrate diff`, somente leitura) para ver exatamente
   o que diverge.
3. Se o diff só mostra mudanças esperadas (novos campos/tabelas do schema.prisma ainda sem
   migração), seguir o fluxo normal (`db:migrate:create` → revisar → `db:migrate:deploy`).
4. Se o diff mostra remoção de coluna/tabela ou qualquer coisa inesperada, **parar** e investigar
   manualmente antes de qualquer comando — não deixar o Prisma "resolver sozinho".
5. Se `_prisma_migrations` sumiu mas as tabelas de dado continuam íntegras (drift só na
   bookkeeping), fazer backup, então baselinear cada migração existente uma por uma com
   `prisma migrate resolve --applied <nome>` (nunca em loop automatizado sem revisão — rodar e
   conferir a saída de cada uma) até a pasta `prisma/migrations` bater com o histórico, então
   confirmar com `prisma migrate status`.
6. Sempre validar com `prisma validate` e contagens de linhas antes/depois de qualquer etapa.
