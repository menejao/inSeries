import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { canUseDatabase } from "@/lib/db/health";
import { hashPassword } from "@/lib/auth/password";
import { createSessionToken, getSessionCookieOptions, SESSION_COOKIE } from "@/lib/auth/session";
import { withApiObservability } from "@/lib/http/api-handler";
import { checkRateLimit, getClientIdentifier } from "@/lib/rate-limit";
import { incrementRegistration } from "@/lib/metrics/service";
import { logger } from "@/lib/logger";
import { getOrCreateRequestId } from "@/lib/observability/request-id";

const registerSchema = z.object({
  name: z.string().min(2),
  username: z.string().min(3),
  email: z.string().email(),
  password: z.string().min(8)
});

async function registerHandler(request: Request) {
  const requestId = getOrCreateRequestId(request);
  const rateLimit = checkRateLimit("register", getClientIdentifier(request));
  if (!rateLimit.allowed) {
    return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  }

  if (!(await canUseDatabase())) {
    return NextResponse.json({ error: "database_unavailable" }, { status: 503 });
  }

  const body = await request.json();
  const payload = registerSchema.safeParse(body);

  if (!payload.success) {
    return NextResponse.json({ error: "invalid_payload" }, { status: 400 });
  }

  const existing = await prisma.user.findFirst({
    where: {
      OR: [{ email: payload.data.email }, { username: payload.data.username }]
    }
  });

  if (existing) {
    return NextResponse.json({ error: "user_already_exists" }, { status: 409 });
  }

  const passwordHash = await hashPassword(payload.data.password);
  const user = await prisma.user.create({
    data: {
      name: payload.data.name,
      username: payload.data.username,
      email: payload.data.email,
      passwordHash
    }
  });

  const token = await createSessionToken({
    sub: user.id,
    email: user.email,
    username: user.username,
    name: user.name,
    role: user.role
  });

  incrementRegistration();
  logger.info("user_registered", { requestId, route: "auth.register", userId: user.id });

  const response = NextResponse.json({ ok: true, next: "/me" }, { status: 201 });
  response.cookies.set(SESSION_COOKIE, token, getSessionCookieOptions());
  return response;
}

export const POST = withApiObservability("auth.register", registerHandler);
