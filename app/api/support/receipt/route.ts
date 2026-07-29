import { NextResponse } from "next/server";
import { z } from "zod";
import { getApiUser } from "@/lib/auth/server";
import { withApiObservability } from "@/lib/http/api-handler";
import { canAccessSupporterProgram } from "@/lib/supporters/access";
import { uploadReceipt } from "@/lib/supporters/service";

const receiptSchema = z.object({
  supportRequestId: z.string().min(1),
  receiptDataUrl: z.string().startsWith("data:image/").max(2_000_000)
});

function errorStatus(error: "not_found" | "forbidden" | "already_reviewed" | "receipt_too_large") {
  if (error === "not_found") return 404;
  if (error === "forbidden") return 403;
  return 400;
}

/** INSERIES-SUPPORTER-ACTIVATION-01 — "Envio do comprovante": moves the request to AWAITING_REVIEW. Never activates anything by itself. */
async function receiptHandler(request: Request) {
  const user = await getApiUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!canAccessSupporterProgram(user.role)) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const body = await request.json();
  const payload = receiptSchema.safeParse(body);
  if (!payload.success) return NextResponse.json({ error: "invalid_payload" }, { status: 400 });

  const result = await uploadReceipt(user.id, payload.data.supportRequestId, payload.data.receiptDataUrl);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: errorStatus(result.error) });

  return NextResponse.json({ data: { ok: true } });
}

export const POST = withApiObservability("support.receipt", receiptHandler);
