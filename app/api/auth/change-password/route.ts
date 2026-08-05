import { NextResponse } from "next/server";
import { z } from "zod";
import { getApiUser } from "@/lib/auth/server";
import { prisma } from "@/lib/db/prisma";
import { hashPassword } from "@/lib/auth/password";
import { createSessionToken, getSessionCookieOptions, SESSION_COOKIE } from "@/lib/auth/session";
import { withApiObservability } from "@/lib/http/api-handler";

const schema = z.object({ password: z.string().min(8) });

/**
 * INSERIES-ADMIN-PASSWORD-RESET-01 — usado tanto pela troca forcada (mustChangePassword,
 * ver middleware.ts) quanto por uma troca voluntaria em Configuracoes: define a nova senha,
 * limpa `mustChangePassword` e reemite a sessao (o claim antigo, se `true`, ficaria preso
 * senao o cookie fosse trocado por um novo sem essa flag).
 */
async function changePasswordHandler(request: Request) {
  const user = await getApiUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const payload = schema.safeParse(body);
  if (!payload.success) {
    return NextResponse.json({ error: "invalid_payload" }, { status: 400 });
  }

  const passwordHash = await hashPassword(payload.data.password);
  const updated = await prisma.user.update({
    where: { id: user.id },
    data: { passwordHash, mustChangePassword: false }
  });

  const token = await createSessionToken({
    sub: updated.id,
    email: updated.email,
    username: updated.username,
    name: updated.name,
    role: updated.role,
    mustChangePassword: false
  });

  const response = NextResponse.json({ ok: true });
  response.cookies.set(SESSION_COOKIE, token, getSessionCookieOptions());
  return response;
}

export const POST = withApiObservability("auth.change-password", changePasswordHandler);
