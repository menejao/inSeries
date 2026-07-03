import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/auth/session";
import { REQUEST_ID_HEADER, getOrCreateRequestId } from "@/lib/observability/request-id";

const protectedRoutes = ["/me", "/settings", "/notifications"];
const adminRoles = new Set(["ADMIN", "MODERATOR"]);

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
