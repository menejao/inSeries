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
- Rotas protegidas: `/me`, `/me/watching`, `/me/completed`, `/me/watchlist`, `/settings`
- Senha nunca fica em texto puro; hash usa `scrypt`

## Progresso

- Status salvo em `UserSeriesStatus`
- Episodios assistidos salvos em `UserEpisodeProgress`
- Progresso calcula total, assistidos, porcentagem e proximo episodio
- Usuario nao autenticado continua vendo catalogo publico, mas recebe CTA para login ao salvar progresso

## Catalogo

- `npm run seed:dev`: cria localmente 2 series, 2 temporadas por serie e 5 episodios por temporada, sem depender de chave do TMDb. Use para validar cadastro, login, status e progresso com banco real
- `npm run seed:catalog` (alias `npm run catalog:seed`): importa series populares do TMDb para o banco; e ignorado automaticamente se `TMDB_API_KEY`/`TMDB_ACCESS_TOKEN` nao estiverem configurados ou se o banco estiver indisponivel
- `POST /api/catalog/import`: prepara importacao sob demanda via `tmdbId`
- `/series`: consulta banco e usa fallback mock apenas quando o banco estiver indisponivel
- `/series/[id]`: mostra serie, temporadas, episodios e progresso do usuario autenticado

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
7. alteracao de status da serie para `WATCHING`;
8. marcar, desmarcar e marcar novamente um episodio, validando recalculo de progresso e proximo episodio;
9. logout e confirmacao de que a sessao foi invalidada.

## Comandos

- `npm install`: instala dependencias
- `docker compose up -d`: sobe o Postgres local
- `npx prisma migrate dev`: aplica migrations no banco local
- `npx prisma generate`: gera o Prisma Client
- `npm run seed:dev`: popula catalogo minimo de teste (2 series, 2 temporadas, 5 episodios cada)
- `npm run seed:catalog`: executa seed do catalogo real via TMDb (opcional)
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
