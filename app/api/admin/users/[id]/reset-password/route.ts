import { NextResponse } from "next/server";
import { randomBytes } from "node:crypto";
import { getAdminApiUser } from "@/lib/admin/rbac";
import { prisma } from "@/lib/db/prisma";
import { hashPassword } from "@/lib/auth/password";
import { withApiObservability } from "@/lib/http/api-handler";

/** Legivel, sem caracteres ambiguos (0/O, 1/l/I) — o admin vai ditar/copiar isso pro usuario. */
const TEMP_PASSWORD_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";

function generateTempPassword(length = 12) {
  const bytes = randomBytes(length);
  return Array.from(bytes, (byte) => TEMP_PASSWORD_ALPHABET[byte % TEMP_PASSWORD_ALPHABET.length]).join("");
}

/**
 * INSERIES-ADMIN-PASSWORD-RESET-01 — "reseta a senha dele pra uma temporaria... quando ele
 * logar, pede pra criar uma nova senha": unica operacao que gera a temporaria (nunca aceita
 * uma senha escolhida pelo admin — evitaria o forced-reset), marca `mustChangePassword` e
 * devolve a senha em texto puro UMA vez nesta resposta (nunca fica logada nem persistida).
 */
async function resetPasswordHandler(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const admin = await getAdminApiUser("admin.users");
  if (!admin) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const target = await prisma.user.findUnique({ where: { id }, select: { id: true, username: true } });
  if (!target) {
    return NextResponse.json({ error: "user_not_found" }, { status: 404 });
  }

  const tempPassword = generateTempPassword();
  const passwordHash = await hashPassword(tempPassword);

  await prisma.user.update({
    where: { id: target.id },
    data: { passwordHash, mustChangePassword: true }
  });

  return NextResponse.json({ data: { tempPassword } });
}

export const POST = withApiObservability("admin.users.reset-password", resetPasswordHandler);
