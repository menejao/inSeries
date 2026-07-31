# Database Rules

Nunca execute diretamente:

- `prisma migrate reset`
- `prisma db push`
- `prisma migrate dev`

Sempre use os wrappers:

```bash
npm run db:migrate:create
npm run db:migrate:deploy
```

Nunca execute comando destrutivo sem `ALLOW_DESTRUCTIVE_MIGRATION=1` definido explicitamente
pelo usuário na hora (nunca fixar essa variável em script/config permanente).

Antes de qualquer migração (os wrappers acima já fazem isso automaticamente):
- gerar backup (`npm run db:backup`);
- validar que `SHADOW_DATABASE_URL` existe e é diferente de `DATABASE_URL`;
- validar `DB_ENVIRONMENT` explicitamente definido.

Banco principal: `DATABASE_URL`. Shadow (só para diff, nunca dados reais): `SHADOW_DATABASE_URL`.

Detalhe completo do porquê e do fluxo seguro: [docs/database-migrations.md](docs/database-migrations.md).
