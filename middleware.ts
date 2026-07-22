import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/auth/session";
import { REQUEST_ID_HEADER, getOrCreateRequestId } from "@/lib/observability/request-id";

const protectedRoutes = ["/me", "/settings", "/recommendations"];
const adminRoles = new Set(["ADMIN", "MODERATOR"]);

/**
 * Fase 1 (INSERIES-PRODUCT-EXPERIENCE-REVOLUTION-01) — 4 rotas antigas que so faziam
 * `redirect()` (nenhuma UI propria) foram removidas de app/me/*; o redirect em si vira uma
 * regra aqui, sem manter 4 arquivos de pagina so pra isso. Match exato de pathname (nao
 * prefixo) — nunca intercepta /me/minha-lista, /me/stats etc.
 */
const legacyRedirects: Record<string, string> = {
  "/me": "/",
  "/me/watching": "/me/minha-lista#grupo-watching",
  "/me/completed": "/me/minha-lista#grupo-completed",
  "/me/watchlist": "/me/minha-lista#grupo-want_to_watch",
  // /lists e /me/lists unificados numa rota so (INSERIES-PRODUCT-EXPERIENCE-REVOLUTION-01,
  // Fase 2): "/lists" ganhou a aba "Minhas listas" via ?view=minhas.
  "/me/lists": "/lists?view=minhas",
  // /watch-next fundido no Dashboard (Fase 2): a fila que ele mostrava (getWatchNextForUser)
  // ja alimenta "Novos para voce"/"Pendencias" do Dashboard (com dedup, Fase 7 da sprint 03).
  // Nao precisa mais de gate de autenticacao proprio - "/" ja trata anonimo (Landing) vs
  // autenticado (Dashboard) sozinho.
  "/watch-next": "/"
};

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const isAdminRoute = pathname.startsWith("/admin");
  const isProtected = protectedRoutes.some((route) => pathname.startsWith(route));
  const requestId = getOrCreateRequestId(request);

  function withRequestId(response: NextResponse) {
    response.headers.set(REQUEST_ID_HEADER, requestId);
    return response;
  }

  // Forward the (possibly newly-minted) request id downstream so route handlers
  // and server components can read it back via the same header, and so it's
  // stable end-to-end even for requests middleware doesn't otherwise touch.
  const forwardedHeaders = new Headers(request.headers);
  forwardedHeaders.set(REQUEST_ID_HEADER, requestId);

  // Checado antes do gate de protectedRoutes: "/watch-next" nunca foi adicionado a
  // protectedRoutes (nao precisa mais de auth propria - "/" ja trata anonimo vs
  // autenticado), entao o `return` antecipado logo abaixo pra rotas nao-protegidas nunca
  // alcancava este bloco quando ele vinha depois - 404 real (app/watch-next/ nao existe
  // mais), nunca redirecionava. Achado rodando o smoke test de verdade contra servidor
  // local (Docker disponivel outra vez). Os alvos de /me/watching|completed|watchlist|lists
  // continuam protegidos no proprio destino (prefixo "/me" ainda em protectedRoutes, ou
  // requireUser() dentro da pagina para /lists?view=minhas) - nenhum buraco de seguranca.
  const legacyTarget = legacyRedirects[pathname];
  if (legacyTarget) {
    return withRequestId(NextResponse.redirect(new URL(legacyTarget, request.url)));
  }

  if (!isProtected && !isAdminRoute) {
    return withRequestId(NextResponse.next({ request: { headers: forwardedHeaders } }));
  }

  const token = request.cookies.get(SESSION_COOKIE)?.value;
  const session = await verifySessionToken(token);

  if (!session) {
    return withRequestId(NextResponse.redirect(new URL("/login", request.url)));
  }

  if (isAdminRoute && !adminRoles.has(session.role ?? "USER")) {
    return withRequestId(NextResponse.redirect(new URL("/", request.url)));
  }

  return withRequestId(NextResponse.next({ request: { headers: forwardedHeaders } }));
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|manifest.webmanifest|icons|sw.js).*)"]
};
