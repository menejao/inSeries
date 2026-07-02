import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/auth/session";

const protectedRoutes = ["/me", "/settings", "/notifications"];
const adminRoles = new Set(["ADMIN", "MODERATOR"]);

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const isAdminRoute = pathname.startsWith("/admin");
  const isProtected = protectedRoutes.some((route) => pathname.startsWith(route));

  if (!isProtected && !isAdminRoute) {
    return NextResponse.next();
  }

  const token = request.cookies.get(SESSION_COOKIE)?.value;
  const session = await verifySessionToken(token);

  if (!session) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  if (isAdminRoute && !adminRoles.has(session.role ?? "USER")) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/me/:path*", "/settings/:path*", "/admin/:path*", "/notifications/:path*"]
};
