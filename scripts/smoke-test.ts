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

async function main() {
  const jar: CookieJar = { value: "" };
  const suffix = Date.now();
  const email = `smoke-${suffix}@inseries.test`;
  const username = `smoke${suffix}`;
  const password = "senha1234";

  console.log(`Smoke test contra ${BASE_URL}`);

  const register = await request(jar, "/api/auth/register", {
    method: "POST",
    body: JSON.stringify({ name: "Smoke Test", username, email, password })
  });
  check("cadastro cria usuario (201)", register.status === 201, register.body);
  check("cadastro retorna cookie de sessao", Boolean(jar.value), jar.value);

  const meAfterRegister = await request(jar, "/api/auth/me");
  check("sessao valida apos cadastro (/api/auth/me 200)", meAfterRegister.status === 200, meAfterRegister.body);

  await request(jar, "/api/auth/logout", { method: "POST" });
  jar.value = "";

  const login = await request(jar, "/api/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password })
  });
  check("login autentica usuario (200)", login.status === 200, login.body);
  check("login retorna cookie de sessao", Boolean(jar.value), jar.value);

  const me = await request(jar, "/api/auth/me");
  check("/api/auth/me retorna usuario autenticado", me.status === 200 && me.body?.data?.email === email, me.body);

  const meBlocked = await request({ value: "" }, "/me");
  check("/me sem sessao redireciona (307/302)", meBlocked.status === 307 || meBlocked.status === 302, meBlocked.status);

  const catalog = await request(jar, "/api/catalog/series");
  const seriesId: string | undefined = catalog.body?.data?.[0]?.id;
  const episodeId: string | undefined = catalog.body?.data?.[0]?.seasons?.[0]?.episodes?.[0]?.id;
  check("catalogo retorna ao menos uma serie seedada", Boolean(seriesId), catalog.body);
  check("serie seedada possui episodios", Boolean(episodeId), catalog.body);

  if (!seriesId || !episodeId) {
    console.error("Aborting: rode `npm run seed:dev` antes do smoke test.");
    process.exitCode = 1;
    return;
  }

  const setStatus = await request(jar, `/api/series/${seriesId}/status`, {
    method: "POST",
    body: JSON.stringify({ seriesId, state: "WATCHING" })
  });
  check("status da serie salvo como WATCHING", setStatus.status === 200 && setStatus.body?.data?.state === "WATCHING", setStatus.body);

  const markWatched = await request(jar, `/api/episodes/${episodeId}/progress`, {
    method: "POST",
    body: JSON.stringify({ episodeId, watched: true })
  });
  check("episodio marcado como assistido", markWatched.status === 200 && markWatched.body?.data?.watchedEpisodes === 1, markWatched.body);

  const unmarkWatched = await request(jar, `/api/episodes/${episodeId}/progress`, {
    method: "POST",
    body: JSON.stringify({ episodeId, watched: false })
  });
  check("episodio desmarcado", unmarkWatched.status === 200 && unmarkWatched.body?.data?.watchedEpisodes === 0, unmarkWatched.body);

  const remarkWatched = await request(jar, `/api/episodes/${episodeId}/progress`, {
    method: "POST",
    body: JSON.stringify({ episodeId, watched: true })
  });
  check(
    "episodio marcado novamente e progresso recalculado",
    remarkWatched.status === 200 && remarkWatched.body?.data?.watchedEpisodes === 1 && Boolean(remarkWatched.body?.data?.nextEpisode),
    remarkWatched.body
  );

  await request(jar, "/api/auth/logout", { method: "POST" });
  jar.value = "";

  const meAfterLogout = await request(jar, "/api/auth/me");
  check("logout invalida sessao (/api/auth/me 401)", meAfterLogout.status === 401, meAfterLogout.body);

  console.log("");
  if (failures > 0) {
    console.error(`Smoke test falhou: ${failures} verificacao(oes) com erro.`);
    process.exitCode = 1;
  } else {
    console.log("Smoke test concluido com sucesso: fluxo principal validado ponta a ponta.");
  }
}

main().catch((error) => {
  console.error("Smoke test quebrou com excecao nao tratada.");
  console.error(error);
  process.exitCode = 1;
});
