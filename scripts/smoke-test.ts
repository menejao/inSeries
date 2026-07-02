const BASE_URL = process.env.SMOKE_BASE_URL ?? "http://localhost:3000";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Json = any;

type CookieJar = { value: string };

function extractCookie(response: Response, jar: CookieJar) {
  const setCookie = response.headers.get("set-cookie");
  if (!setCookie) return;
  const [pair] = setCookie.split(";");
  jar.value = pair;
}

async function request(
  jar: CookieJar,
  path: string,
  init: RequestInit = {}
): Promise<{ status: number; body: Json }> {
  const response = await fetch(`${BASE_URL}${path}`, {
    ...init,
    redirect: "manual",
    headers: {
      ...(init.body ? { "Content-Type": "application/json" } : {}),
      ...(jar.value ? { Cookie: jar.value } : {})
    }
  });

  extractCookie(response, jar);

  let body: Json = null;
  const text = await response.text();
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = text;
  }

  return { status: response.status, body };
}

let failures = 0;

function check(label: string, condition: boolean, detail?: unknown) {
  if (condition) {
    console.log(`OK   - ${label}`);
  } else {
    failures += 1;
    console.error(`FAIL - ${label}`, detail ?? "");
  }
}

function countOccurrences(haystack: string, needle: string) {
  return haystack.split(needle).length - 1;
}

async function registerUser(jar: CookieJar, label: string) {
  const suffix = `${Date.now()}${Math.floor(Math.random() * 1000)}`;
  const email = `${label}-${suffix}@inseries.test`;
  const username = `${label}${suffix}`;
  const password = "senha1234";

  const register = await request(jar, "/api/auth/register", {
    method: "POST",
    body: JSON.stringify({ name: `Smoke ${label}`, username, email, password })
  });

  check(`cadastro do usuario ${label} cria conta (201)`, register.status === 201, register.body);
  return { email, username, password };
}

async function main() {
  console.log(`Smoke test contra ${BASE_URL}`);

  // ---- Fluxo principal: cadastro, login, sessao, catalogo, progresso ----
  const jarA: CookieJar = { value: "" };
  const userA = await registerUser(jarA, "usera");
  check("cadastro retorna cookie de sessao", Boolean(jarA.value), jarA.value);

  const meAfterRegister = await request(jarA, "/api/auth/me");
  check("sessao valida apos cadastro (/api/auth/me 200)", meAfterRegister.status === 200, meAfterRegister.body);

  await request(jarA, "/api/auth/logout", { method: "POST" });
  jarA.value = "";

  const login = await request(jarA, "/api/auth/login", {
    method: "POST",
    body: JSON.stringify({ email: userA.email, password: userA.password })
  });
  check("login autentica usuario (200)", login.status === 200, login.body);
  check("login retorna cookie de sessao", Boolean(jarA.value), jarA.value);

  const me = await request(jarA, "/api/auth/me");
  check("/api/auth/me retorna usuario autenticado", me.status === 200 && me.body?.data?.email === userA.email, me.body);

  const meBlocked = await request({ value: "" }, "/me");
  check("/me sem sessao redireciona (307/302)", meBlocked.status === 307 || meBlocked.status === 302, meBlocked.status);

  const catalog = await request(jarA, "/api/catalog/series");
  const seriesId: string | undefined = catalog.body?.data?.[0]?.id;
  const episodeId: string | undefined = catalog.body?.data?.[0]?.seasons?.[0]?.episodes?.[0]?.id;
  check("catalogo retorna ao menos uma serie seedada", Boolean(seriesId), catalog.body);
  check("serie seedada possui episodios", Boolean(episodeId), catalog.body);

  if (!seriesId || !episodeId) {
    console.error("Aborting: rode `npm run seed:dev` antes do smoke test.");
    process.exitCode = 1;
    return;
  }

  // ---- Descoberta e busca: filtros de /series e /api/search ----
  const seriesNoFilter = await request(jarA, "/series");
  check(
    "/series sem filtro lista series seedadas",
    seriesNoFilter.status === 200 && String(seriesNoFilter.body).includes("Serie Teste Um"),
    seriesNoFilter.status
  );

  const seriesByQuery = await request(jarA, "/series?q=Tres");
  check(
    "/series?q= filtra por texto (encontra, exclui outras)",
    seriesByQuery.status === 200 &&
      String(seriesByQuery.body).includes("Serie Teste Tres") &&
      !String(seriesByQuery.body).includes("Serie Teste Um"),
    seriesByQuery.status
  );

  const seriesByGenre = await request(jarA, "/series?genre=Mystery");
  check(
    "/series?genre= filtra por genero (so series com o genero aparecem)",
    seriesByGenre.status === 200 &&
      String(seriesByGenre.body).includes("Serie Teste Tres") &&
      !String(seriesByGenre.body).includes("Serie Teste Um"),
    seriesByGenre.status
  );

  const seriesByStatus = await request(jarA, "/series?status=IN_PRODUCTION");
  check(
    "/series?status= filtra por status do catalogo",
    seriesByStatus.status === 200 &&
      String(seriesByStatus.body).includes("Serie Teste Quatro") &&
      !String(seriesByStatus.body).includes("Serie Teste Um"),
    seriesByStatus.status
  );

  const seriesByYear = await request(jarA, "/series?year=2016");
  check(
    "/series?year= filtra por ano de estreia",
    seriesByYear.status === 200 &&
      String(seriesByYear.body).includes("Serie Teste Tres") &&
      !String(seriesByYear.body).includes("Serie Teste Um"),
    seriesByYear.status
  );

  const seriesSortPopular = await request(jarA, "/series?sort=popular");
  const popularBody = String(seriesSortPopular.body);
  check(
    "/series?sort=popular ordena por popularidade desc",
    seriesSortPopular.status === 200 && popularBody.indexOf("Serie Teste Um") < popularBody.indexOf("Serie Teste Cinco"),
    seriesSortPopular.status
  );

  const seriesSortLatest = await request(jarA, "/series?sort=latest");
  const latestBody = String(seriesSortLatest.body);
  check(
    "/series?sort=latest ordena por data de estreia desc",
    seriesSortLatest.status === 200 && latestBody.indexOf("Serie Teste Quatro") < latestBody.indexOf("Serie Teste Tres"),
    seriesSortLatest.status
  );

  const seriesSortTitle = await request(jarA, "/series?sort=title");
  const titleBody = String(seriesSortTitle.body);
  check(
    "/series?sort=title ordena alfabeticamente",
    seriesSortTitle.status === 200 && titleBody.indexOf("Serie Teste Cinco") < titleBody.indexOf("Serie Teste Um"),
    seriesSortTitle.status
  );

  const seriesSortRating = await request(jarA, "/series?sort=rating");
  const ratingBody = String(seriesSortRating.body);
  check(
    "/series?sort=rating ordena por nota desc (sem nota fica por ultimo)",
    seriesSortRating.status === 200 &&
      ratingBody.indexOf("Serie Teste Um") < ratingBody.indexOf("Serie Teste Quatro"),
    seriesSortRating.status
  );

  const apiSearchAll = await request(jarA, "/api/search?type=series");
  check(
    "/api/search?type=series sem q retorna series",
    apiSearchAll.status === 200 && Array.isArray(apiSearchAll.body?.data?.series) && apiSearchAll.body.data.series.length > 0,
    apiSearchAll.body
  );

  const apiSearchQuery = await request(jarA, "/api/search?type=series&q=Cinco");
  check(
    "/api/search?type=series&q= filtra corretamente",
    apiSearchQuery.status === 200 &&
      apiSearchQuery.body?.data?.series?.length === 1 &&
      apiSearchQuery.body?.data?.series?.[0]?.title === "Serie Teste Cinco",
    apiSearchQuery.body
  );

  const apiSearchOtherTypes = await request(jarA, "/api/search?type=all&q=Teste");
  check(
    "/api/search?type=all prepara users/lists/reviews (arrays presentes)",
    apiSearchOtherTypes.status === 200 &&
      Array.isArray(apiSearchOtherTypes.body?.data?.users) &&
      Array.isArray(apiSearchOtherTypes.body?.data?.lists) &&
      Array.isArray(apiSearchOtherTypes.body?.data?.reviews),
    apiSearchOtherTypes.body
  );

  const setStatus = await request(jarA, `/api/series/${seriesId}/status`, {
    method: "POST",
    body: JSON.stringify({ seriesId, state: "WATCHING" })
  });
  check("status da serie salvo como WATCHING", setStatus.status === 200 && setStatus.body?.data?.state === "WATCHING", setStatus.body);

  const markWatched = await request(jarA, `/api/episodes/${episodeId}/progress`, {
    method: "POST",
    body: JSON.stringify({ episodeId, watched: true })
  });
  check("episodio marcado como assistido", markWatched.status === 200 && markWatched.body?.data?.watchedEpisodes === 1, markWatched.body);

  const unmarkWatched = await request(jarA, `/api/episodes/${episodeId}/progress`, {
    method: "POST",
    body: JSON.stringify({ episodeId, watched: false })
  });
  check("episodio desmarcado", unmarkWatched.status === 200 && unmarkWatched.body?.data?.watchedEpisodes === 0, unmarkWatched.body);

  const remarkWatched = await request(jarA, `/api/episodes/${episodeId}/progress`, {
    method: "POST",
    body: JSON.stringify({ episodeId, watched: true })
  });
  check(
    "episodio marcado novamente e progresso recalculado",
    remarkWatched.status === 200 && remarkWatched.body?.data?.watchedEpisodes === 1 && Boolean(remarkWatched.body?.data?.nextEpisode),
    remarkWatched.body
  );

  // ---- Calendario: pessoal, global, proximo episodio, dashboard, filtros ----
  const seriesDetail = await request(jarA, "/api/catalog/series");
  const trackedSeries = seriesDetail.body?.data?.find((item: Json) => item.id === seriesId);
  const allEpisodes: Array<{ id: string; title: string; airedOn: string }> = (trackedSeries?.seasons ?? []).flatMap(
    (season: Json) => season.episodes ?? []
  );
  const now = new Date();
  const todayStr = now.toISOString().slice(0, 10);
  const todayEpisode = allEpisodes.find((episode) => episode.airedOn === todayStr);
  const futureSeason = (trackedSeries?.seasons ?? []).find((season: Json) => (season.episodes ?? []).length === 0);

  const calendarGuest = await request({ value: "" }, "/calendar");
  check(
    "calendario sem sessao mostra CTA de login (nao redireciona)",
    calendarGuest.status === 200 && String(calendarGuest.body).includes("Entre para ver seu calendario"),
    calendarGuest.status
  );

  const calendarPersonal = await request(jarA, "/calendar");
  check("calendario pessoal carrega (200)", calendarPersonal.status === 200, calendarPersonal.status);
  check(
    "calendario pessoal mostra episodio de hoje na secao Hoje",
    Boolean(todayEpisode) && String(calendarPersonal.body).includes(todayEpisode?.title ?? "__none__"),
    todayEpisode
  );
  check(
    "calendario pessoal mostra temporada futura sem episodios",
    Boolean(futureSeason) && String(calendarPersonal.body).includes(futureSeason?.title ?? "__none__"),
    futureSeason
  );

  const calendarGlobalToday = await request(jarA, "/calendar?view=global&range=today");
  check(
    "calendario global (hoje) mostra episodio lancado hoje",
    calendarGlobalToday.status === 200 && Boolean(todayEpisode) && String(calendarGlobalToday.body).includes(todayEpisode?.title ?? "__none__"),
    todayEpisode
  );

  const calendarOnlyMine = await request(jarA, "/calendar?view=global&range=month&onlyMine=1");
  check(
    "filtro apenas minhas series funciona (inclui serie que o usuario acompanha)",
    calendarOnlyMine.status === 200 && String(calendarOnlyMine.body).includes(trackedSeries?.title ?? "__none__"),
    trackedSeries?.title
  );

  const nextEpisodeSeriesPage = await request(jarA, `/series/${seriesId}`);
  check(
    "pagina da serie mostra secao Proximo episodio",
    nextEpisodeSeriesPage.status === 200 && String(nextEpisodeSeriesPage.body).includes("Proximo episodio"),
    nextEpisodeSeriesPage.status
  );

  const dashboard = await request(jarA, "/me");
  check(
    "dashboard /me mostra secao Proximos episodios",
    dashboard.status === 200 && String(dashboard.body).includes("Proximos episodios"),
    dashboard.status
  );

  // ---- Fundacao social: follow, listas, reviews, privacidade, ownership ----
  const jarB: CookieJar = { value: "" };
  const userB = await registerUser(jarB, "userb");

  const follow = await request(jarA, `/api/users/${userB.username}/follow`, { method: "POST" });
  check("usuario A segue usuario B", follow.status === 200 && follow.body?.data?.following === true, follow.body);

  const selfFollow = await request(jarA, `/api/users/${userA.username}/follow`, { method: "POST" });
  check("usuario nao pode seguir a si mesmo", selfFollow.status === 400, selfFollow.body);

  const duplicateFollow = await request(jarA, `/api/users/${userB.username}/follow`, { method: "POST" });
  check("seguir duplicado e idempotente", duplicateFollow.status === 200, duplicateFollow.body);

  const profileBAfterFollow = await request(jarA, `/profile/${userB.username}`);
  check(
    "perfil de B mostra 1 seguidor apos follow",
    profileBAfterFollow.status === 200 && /Seguidores<\/p><p[^>]*>1/.test(String(profileBAfterFollow.body)),
    profileBAfterFollow.status
  );

  const unfollow = await request(jarA, `/api/users/${userB.username}/follow`, { method: "DELETE" });
  check("usuario A deixa de seguir usuario B", unfollow.status === 200 && unfollow.body?.data?.following === false, unfollow.body);

  const profileBAfterUnfollow = await request(jarA, `/profile/${userB.username}`);
  check(
    "perfil de B volta a mostrar 0 seguidores apos unfollow",
    profileBAfterUnfollow.status === 200 && /Seguidores<\/p><p[^>]*>0/.test(String(profileBAfterUnfollow.body)),
    profileBAfterUnfollow.status
  );

  const createList = await request(jarA, "/api/lists", {
    method: "POST",
    body: JSON.stringify({ title: "Lista smoke test", description: "criada pelo smoke test", visibility: "PUBLIC" })
  });
  const listId: string | undefined = createList.body?.data?.id;
  check("usuario A cria lista", createList.status === 201 && Boolean(listId), createList.body);

  if (listId) {
    const addItem = await request(jarA, `/api/lists/${listId}/items`, {
      method: "POST",
      body: JSON.stringify({ seriesId })
    });
    const itemId: string | undefined = addItem.body?.data?.id;
    check("usuario A adiciona serie a lista", addItem.status === 201 && Boolean(itemId), addItem.body);

    const editList = await request(jarA, `/api/lists/${listId}`, {
      method: "PATCH",
      body: JSON.stringify({ title: "Lista smoke test editada" })
    });
    check("usuario A edita a propria lista", editList.status === 200, editList.body);

    const bEditsAList = await request(jarB, `/api/lists/${listId}`, {
      method: "PATCH",
      body: JSON.stringify({ title: "Hackeado" })
    });
    check("usuario B nao consegue editar lista de A (403)", bEditsAList.status === 403, bEditsAList.body);

    const bDeletesAList = await request(jarB, `/api/lists/${listId}`, { method: "DELETE" });
    check("usuario B nao consegue apagar lista de A (403)", bDeletesAList.status === 403, bDeletesAList.body);

    if (itemId) {
      const removeItem = await request(jarA, `/api/lists/${listId}/items/${itemId}`, { method: "DELETE" });
      check("usuario A remove serie da lista", removeItem.status === 200, removeItem.body);
    }

    const deleteList = await request(jarA, `/api/lists/${listId}`, { method: "DELETE" });
    check("usuario A apaga a propria lista", deleteList.status === 200, deleteList.body);
  }

  const createReview = await request(jarA, `/api/series/${seriesId}/reviews`, {
    method: "POST",
    body: JSON.stringify({ rating: 5, body: "Review inicial do smoke test", visibility: "PUBLIC" })
  });
  check("usuario A cria review", createReview.status === 200 && createReview.body?.data?.rating === 5, createReview.body);

  const editReview = await request(jarA, `/api/series/${seriesId}/reviews`, {
    method: "POST",
    body: JSON.stringify({ rating: 4, body: "Review editada pelo smoke test", visibility: "PUBLIC" })
  });
  check(
    "usuario A edita a propria review (mesmo id, dados atualizados)",
    editReview.status === 200 &&
      editReview.body?.data?.id === createReview.body?.data?.id &&
      editReview.body?.data?.rating === 4,
    editReview.body
  );

  const bReviewsSameSeries = await request(jarB, `/api/series/${seriesId}/reviews`, {
    method: "POST",
    body: JSON.stringify({ rating: 1, body: "Review da B, independente da review de A", visibility: "PUBLIC" })
  });
  check(
    "usuario B nao consegue editar review de A (cria a propria, id diferente)",
    bReviewsSameSeries.status === 200 && bReviewsSameSeries.body?.data?.id !== createReview.body?.data?.id,
    bReviewsSameSeries.body
  );

  const seriesPageAfterReviews = await request(jarA, `/series/${seriesId}`);
  check(
    "review de A permanece intacta apos review de B",
    seriesPageAfterReviews.status === 200 && String(seriesPageAfterReviews.body).includes("Review editada pelo smoke test"),
    seriesPageAfterReviews.status
  );

  const deleteReview = await request(jarA, `/api/series/${seriesId}/reviews`, { method: "DELETE" });
  check("usuario A apaga a propria review", deleteReview.status === 200, deleteReview.body);

  await request(jarB, `/api/series/${seriesId}/reviews`, { method: "DELETE" });

  const setPrivate = await request(jarA, "/api/profile", {
    method: "PATCH",
    body: JSON.stringify({ isProfilePrivate: true })
  });
  check("usuario A define perfil como privado", setPrivate.status === 200 && setPrivate.body?.data?.isProfilePrivate === true, setPrivate.body);

  const profileAAsB = await request(jarB, `/profile/${userA.username}`);
  check(
    "perfil privado de A oculta dados para B",
    profileAAsB.status === 200 && String(profileAAsB.body).includes("Perfil privado"),
    profileAAsB.status
  );

  const profileAAsOwner = await request(jarA, `/profile/${userA.username}`);
  check(
    "dono ve proprio perfil completo mesmo privado",
    profileAAsOwner.status === 200 && !String(profileAAsOwner.body).includes("Perfil privado"),
    profileAAsOwner.status
  );

  const revertPrivate = await request(jarA, "/api/profile", {
    method: "PATCH",
    body: JSON.stringify({ isProfilePrivate: false })
  });
  check("usuario A reverte perfil para publico", revertPrivate.status === 200, revertPrivate.body);

  // ---- Feed de atividades: geracao, feed pessoal/global, privacidade ----
  const reFollow = await request(jarA, `/api/users/${userB.username}/follow`, { method: "POST" });
  check("usuario A volta a seguir usuario B (para testar feed pessoal)", reFollow.status === 200, reFollow.body);

  const bStatus = await request(jarB, `/api/series/${seriesId}/status`, {
    method: "POST",
    body: JSON.stringify({ seriesId, state: "WATCHING" })
  });
  check("usuario B altera status da serie (gera atividade)", bStatus.status === 200, bStatus.body);

  const bMarkWatched = await request(jarB, `/api/episodes/${episodeId}/progress`, {
    method: "POST",
    body: JSON.stringify({ episodeId, watched: true })
  });
  check("usuario B marca episodio assistido (gera atividade)", bMarkWatched.status === 200, bMarkWatched.body);

  const meBAfterMark = await request(jarB, "/me");
  const episodeWatchedCountAfterMark = countOccurrences(String(meBAfterMark.body), "S01E01");

  const bUnmarkWatched = await request(jarB, `/api/episodes/${episodeId}/progress`, {
    method: "POST",
    body: JSON.stringify({ episodeId, watched: false })
  });
  check("usuario B desmarca episodio (200, sem erro)", bUnmarkWatched.status === 200, bUnmarkWatched.body);

  const meBAfterUnmark = await request(jarB, "/me");
  const episodeWatchedCountAfterUnmark = countOccurrences(String(meBAfterUnmark.body), "S01E01");
  check(
    "desmarcar episodio nao cria atividade duplicada (contagem identica antes/depois do desmarcar)",
    episodeWatchedCountAfterMark > 0 && episodeWatchedCountAfterUnmark === episodeWatchedCountAfterMark,
    { episodeWatchedCountAfterMark, episodeWatchedCountAfterUnmark }
  );

  const reviewMarker = `Review publica de ${userB.username} para o feed`;
  const listMarker = `Lista publica de ${userB.username} para o feed`;

  const bReview = await request(jarB, `/api/series/${seriesId}/reviews`, {
    method: "POST",
    body: JSON.stringify({ rating: 5, body: reviewMarker, visibility: "PUBLIC" })
  });
  check("usuario B cria review publica (gera atividade)", bReview.status === 200, bReview.body);

  const bList = await request(jarB, "/api/lists", {
    method: "POST",
    body: JSON.stringify({ title: listMarker, visibility: "PUBLIC" })
  });
  check("usuario B cria lista publica (gera atividade)", bList.status === 201, bList.body);

  const feedGuest = await request({ value: "" }, "/feed");
  check(
    "feed sem sessao mostra CTA de login (nao redireciona)",
    feedGuest.status === 200 && String(feedGuest.body).includes("Entre para ver seu feed"),
    feedGuest.status
  );

  const feedPersonalA = await request(jarA, "/feed");
  check(
    "feed pessoal de A mostra atividades de B (que A segue)",
    feedPersonalA.status === 200 &&
      String(feedPersonalA.body).includes(reviewMarker) &&
      String(feedPersonalA.body).includes(listMarker),
    feedPersonalA.status
  );

  const feedGlobalBefore = await request({ value: "" }, "/feed?view=global");
  check(
    "feed global mostra atividades publicas de B",
    feedGlobalBefore.status === 200 && String(feedGlobalBefore.body).includes(listMarker),
    feedGlobalBefore.status
  );

  const bGoesPrivate = await request(jarB, "/api/profile", {
    method: "PATCH",
    body: JSON.stringify({ isProfilePrivate: true })
  });
  check("usuario B define perfil como privado", bGoesPrivate.status === 200, bGoesPrivate.body);

  const feedGlobalAfterPrivate = await request({ value: "" }, "/feed?view=global");
  check(
    "perfil privado nao aparece no feed global",
    feedGlobalAfterPrivate.status === 200 && !String(feedGlobalAfterPrivate.body).includes(listMarker),
    feedGlobalAfterPrivate.status
  );

  const feedPersonalAAfterPrivate = await request(jarA, "/feed");
  check(
    "atividade privada nao aparece para terceiros no feed pessoal",
    feedPersonalAAfterPrivate.status === 200 &&
      !String(feedPersonalAAfterPrivate.body).includes(reviewMarker),
    feedPersonalAAfterPrivate.status
  );

  const meBOwnActivity = await request(jarB, "/me");
  check(
    "/me de B continua mostrando a propria atividade mesmo com perfil privado",
    meBOwnActivity.status === 200 && String(meBOwnActivity.body).includes(listMarker),
    meBOwnActivity.status
  );

  await request(jarB, "/api/profile", {
    method: "PATCH",
    body: JSON.stringify({ isProfilePrivate: false })
  });

  // ---- Encerramento ----
  await request(jarA, "/api/auth/logout", { method: "POST" });
  jarA.value = "";

  const meAfterLogout = await request(jarA, "/api/auth/me");
  check("logout invalida sessao (/api/auth/me 401)", meAfterLogout.status === 401, meAfterLogout.body);

  await request(jarB, "/api/auth/logout", { method: "POST" });

  console.log("");
  if (failures > 0) {
    console.error(`Smoke test falhou: ${failures} verificacao(oes) com erro.`);
    process.exitCode = 1;
  } else {
    console.log(
      "Smoke test concluido com sucesso: fluxo principal, descoberta/busca, calendario, fundacao social e feed de atividades validados ponta a ponta."
    );
  }
}

main().catch((error) => {
  console.error("Smoke test quebrou com excecao nao tratada.");
  console.error(error);
  process.exitCode = 1;
});
