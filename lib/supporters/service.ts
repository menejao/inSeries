import { prisma } from "@/lib/db/prisma";
import { config } from "@/lib/config";
import { buildPixPayload, generatePixTxId } from "@/lib/supporters/pix";

export const SUGGESTED_AMOUNTS_CENTS = [500, 1000, 2000];
const MIN_AMOUNT_CENTS = 100;
const MAX_AMOUNT_CENTS = 100000;
// Data-URL cap (~1.5MB of actual image data once decoded) — keeps a receipt comfortably inside
// a single Postgres row without needing object storage for this first version.
const MAX_RECEIPT_DATA_URL_LENGTH = 2_000_000;

export type StartSupportRequestResult =
  | { ok: true; supportRequestId: string; pixPayload: string }
  | { ok: false; error: "invalid_amount" };

/** INSERIES-SUPPORTER-ACTIVATION-01 — creates the PENDING_PAYMENT row and the matching PIX BR Code for the chosen amount. */
export async function startSupportRequest(userId: string, amountCents: number): Promise<StartSupportRequestResult> {
  if (!Number.isInteger(amountCents) || amountCents < MIN_AMOUNT_CENTS || amountCents > MAX_AMOUNT_CENTS) {
    return { ok: false, error: "invalid_amount" };
  }

  const pixTxId = generatePixTxId();
  const supportRequest = await prisma.supportRequest.create({
    data: { userId, amountCents, pixTxId }
  });

  const pixPayload = buildPixPayload({
    pixKey: config.supporters.pixKey,
    receiverName: config.supporters.receiverName,
    receiverCity: config.supporters.receiverCity,
    amount: amountCents / 100,
    txId: pixTxId
  });

  return { ok: true, supportRequestId: supportRequest.id, pixPayload };
}

export type UploadReceiptResult =
  | { ok: true }
  | { ok: false; error: "not_found" | "forbidden" | "already_reviewed" | "receipt_too_large" };

/**
 * "Envio do comprovante" — allowed from PENDING_PAYMENT (first upload) or AWAITING_REVIEW
 * (replace before an admin has reviewed it); moves the request to AWAITING_REVIEW either way.
 * Deliberately never touches UserSupporter — activation only happens via admin approval.
 */
export async function uploadReceipt(userId: string, supportRequestId: string, receiptDataUrl: string): Promise<UploadReceiptResult> {
  if (receiptDataUrl.length > MAX_RECEIPT_DATA_URL_LENGTH) {
    return { ok: false, error: "receipt_too_large" };
  }

  const request = await prisma.supportRequest.findUnique({ where: { id: supportRequestId } });
  if (!request) return { ok: false, error: "not_found" };
  if (request.userId !== userId) return { ok: false, error: "forbidden" };
  if (request.status !== "PENDING_PAYMENT" && request.status !== "AWAITING_REVIEW") {
    return { ok: false, error: "already_reviewed" };
  }

  await prisma.supportRequest.update({
    where: { id: supportRequestId },
    data: { receiptUrl: receiptDataUrl, status: "AWAITING_REVIEW" }
  });

  return { ok: true };
}

/** The requester's own latest request — drives the "pendente de analise" state on /apoie. */
export async function getLatestSupportRequest(userId: string) {
  return prisma.supportRequest.findFirst({
    where: { userId },
    orderBy: { createdAt: "desc" }
  });
}
