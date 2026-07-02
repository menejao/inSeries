# inSeries

Plataforma social focada em series, web-first, mobile-first e preparada para instalacao via PWA.

## Stack

- Next.js 15 + React 19 + TypeScript
- Tailwind CSS
- Prisma + PostgreSQL
- Sessao por cookie assinado com `AUTH_SECRET`
- Hash de senha com `scrypt`
- Integracao TMDb isolada por servico, adapter e normalizadores

## Ambiente

1. Copie `.env.example` para `.env`
2. Ajuste `DATABASE_URL`, `AUTH_SECRET`, `NEXT_PUBLIC_APP_URL` e, se quiser catalogo real, `TMDB_API_KEY` ou `TMDB_ACCESS_TOKEN`
3. Rode `npm install`
4. Rode `npm run prisma:generate`
5. Aplique schema no banco com fluxo Prisma de sua preferencia (`prisma db push` ou migration)
6. Rode `npm run dev`

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

- `npm run seed:catalog`: importa series populares do TMDb para banco
- `npm run catalog:seed`: alias do seed
- `POST /api/catalog/import`: prepara importacao sob demanda via `tmdbId`
- `/series`: consulta banco e usa fallback quando catalogo real nao estiver disponivel
- `/series/[id]`: mostra serie, temporadas, episodios e progresso do usuario autenticado

## Comandos

- `npm install`: instala dependencias
- `npm run dev`: sobe ambiente local
- `npm run prisma:generate`: gera Prisma Client
- `npm run seed:catalog`: executa seed do catalogo
- `npm run typecheck`: valida TypeScript
- `npm run lint`: roda ESLint CLI
- `npm run build`: gera Prisma Client e executa build de producao

## PWA

- Manifest em `app/manifest.ts`
- Service worker base em `public/sw.js`
- Icones placeholder em `public/icons`
- Metadata mobile-first com `themeColor`, `viewportFit` e `display: standalone`
