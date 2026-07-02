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

- `npm run seed:dev`: cria localmente 2 series com pelo menos 2 temporadas e 5 episodios cada, sem depender de chave do TMDb; a "Serie Teste Um" ganha ainda uma temporada com episodios de hoje/esta semana/futuro e uma temporada futura sem episodios, para exercitar todas as secoes do calendario. Use para validar cadastro, login, status, progresso e calendario com banco real
- `npm run seed:catalog` (alias `npm run catalog:seed`): importa series populares do TMDb para o banco; e ignorado automaticamente se `TMDB_API_KEY`/`TMDB_ACCESS_TOKEN` nao estiverem configurados ou se o banco estiver indisponivel
- `POST /api/catalog/import`: prepara importacao sob demanda via `tmdbId`
- `/series`: consulta banco e usa fallback mock apenas quando o banco estiver indisponivel
- `/series/[id]`: mostra serie, temporadas, episodios, progresso do usuario autenticado e reviews da comunidade

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
9. cadastro de um segundo usuario e fundacao social: seguir/deixar de seguir, contadores de seguidores, bloqueio de auto-follow e follow duplicado;
10. listas: criar, editar, adicionar serie, remover serie, apagar, e confirmar que outro usuario nao consegue editar/apagar lista alheia (403);
11. reviews: criar, editar (upsert), apagar, e confirmar que a review de um usuario nao e afetada pela review de outro na mesma serie;
12. privacidade: perfil privado oculta dados para terceiros mas o dono continua vendo tudo;
13. calendario: CTA de login sem sessao, calendario pessoal exibindo episodio de hoje e temporada futura, calendario global filtrado por periodo e por "apenas minhas series", secao "Proximo episodio" na pagina da serie e secao "Proximos episodios" no dashboard `/me`;
14. feed de atividades: geracao de atividade ao seguir usuario, marcar episodio, criar review e criar lista publica; confirmacao de que desmarcar episodio nao gera atividade duplicada; feed pessoal mostrando atividades de quem se segue; feed global mostrando atividades publicas; perfil privado deixando de aparecer no feed global e no feed pessoal de terceiros; `/me` continuando a mostrar a propria atividade mesmo com o perfil privado;
15. logout e confirmacao de que a sessao foi invalidada.

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
