import { NextResponse } from "next/server";
import { getSessionCookieOptions, SESSION_COOKIE } from "@/lib/auth/session";
import { withApiObservability } from "@/lib/http/api-handler";

async function logoutHandler() {
  const response = NextResponse.json({ ok: true, next: "/login" });
  response.cookies.set(SESSION_COOKIE, "", {
    ...getSessionCookieOptions(),
    maxAge: 0
  });
  return response;
}

export const POST = withApiObservability("auth.logout", logoutHandler);
