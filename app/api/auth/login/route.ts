import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { canUseDatabase } from "@/lib/db/health";
import { verifyPassword } from "@/lib/auth/password";
import { createSessionToken, getSessionCookieOptions, SESSION_COOKIE } from "@/lib/auth/session";
import { withApiObservability } from "@/lib/http/api-handler";
import { checkRateLimit, getClientIdentifier } from "@/lib/rate-limit";
import { incrementLogin } from "@/lib/metrics/service";
import { logger } from "@/lib/logger";
import { getOrCreateRequestId } from "@/lib/observability/request-id";

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8)
});

async function loginHandler(request: Request) {
  const requestId = getOrCreateRequestId(request);
  const rateLimit = checkRateLimit("login", getClientIdentifier(request));
  if (!rateLimit.allowed) {
    return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  }

  if (!(await canUseDatabase())) {
    return NextResponse.json({ error: "database_unavailable" }, { status: 503 });
  }

  const body = await request.json();
  const payload = loginSchema.safeParse(body);

  if (!payload.success) {
    return NextResponse.json({ error: "invalid_payload" }, { status: 400 });
  }

  const user = await prisma.user.findUnique({
    where: { email: payload.data.email }
  });

  if (!user) {
    return NextResponse.json({ error: "invalid_credentials" }, { status: 401 });
  }

  const validPassword = await verifyPassword(payload.data.password, user.passwordHash);
  if (!validPassword) {
    return NextResponse.json({ error: "invalid_credentials" }, { status: 401 });
  }

  const token = await createSessionToken({
    sub: user.id,
    email: user.email,
    username: user.username,
    name: user.name,
    role: user.role
  });

  await prisma.user.update({
    where: { id: user.id },
    data: { lastLoginAt: new Date() }
  });

  incrementLogin();
  logger.info("user_login", { requestId, route: "auth.login", userId: user.id });

  const response = NextResponse.json({ ok: true, next: "/me" });
  response.cookies.set(SESSION_COOKIE, token, getSessionCookieOptions());
  return response;
}

export const POST = withApiObservability("auth.login", loginHandler);
