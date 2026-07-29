import { prisma } from "@/lib/db/prisma";
import { config } from "@/lib/config";
import { buildPixPayload, generatePixTxId } from "@/lib/supporters/pix";

export const SUGGESTED_AMOUNTS_CENTS = [500, 1000, 2000];
const MIN_AMOUNT_CENTS = 100;
const MAX_AMOUNT_CENTS = 100000;

export type StartContributionResult = { ok: true; contributionId: string; pixPayload: string } | { ok: false; error: "invalid_amount" };

/** INSERIES-SUPPORTER-SYSTEM-01 — creates the PENDING log row and the matching PIX BR Code for the chosen amount. */
export async function startContribution(userId: string, amountCents: number): Promise<StartContributionResult> {
  if (!Number.isInteger(amountCents) || amountCents < MIN_AMOUNT_CENTS || amountCents > MAX_AMOUNT_CENTS) {
    return { ok: false, error: "invalid_amount" };
  }

  const pixTxId = generatePixTxId();
  const contribution = await prisma.supporterContribution.create({
    data: { userId, amountCents, pixTxId }
  });

  const pixPayload = buildPixPayload({
    pixKey: config.supporters.pixKey,
    receiverName: config.supporters.receiverName,
    receiverCity: config.supporters.receiverCity,
    amount: amountCents / 100,
    txId: pixTxId
  });

  return { ok: true, contributionId: contribution.id, pixPayload };
}

/**
 * Self-reported confirmation ("Ja fiz o PIX") — there is no PSP webhook in this first version
 * to verify the payment automatically (see User.isSupporter doc comment in schema.prisma).
 * Grants only cosmetic entitlements, never anything essential, so an unverified confirmation
 * carries low risk; admins can revoke `isSupporter` if it's ever abused.
 */
export async function confirmContribution(userId: string, contributionId: string) {
  const contribution = await prisma.supporterContribution.findUnique({ where: { id: contributionId } });
  if (!contribution || contribution.userId !== userId || contribution.status !== "PENDING") {
    return { ok: false as const };
  }

  await prisma.$transaction([
    prisma.supporterContribution.update({
      where: { id: contributionId },
      data: { status: "CONFIRMED", confirmedAt: new Date() }
    }),
    prisma.user.update({
      where: { id: userId },
      data: { isSupporter: true }
    })
  ]);

  // supporterSince only set the first time — a separate read+conditional update keeps this
  // one function idempotent without a raw SQL COALESCE.
  await prisma.user.updateMany({ where: { id: userId, supporterSince: null }, data: { supporterSince: new Date() } });

  return { ok: true as const };
}
