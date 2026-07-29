import { NextResponse } from "next/server";
import { z } from "zod";
import { getAdminApiUser } from "@/lib/admin/rbac";
import { withApiObservability } from "@/lib/http/api-handler";
import { checkRateLimit, getClientIdentifier } from "@/lib/rate-limit";
import { rejectSupportRequest } from "@/lib/supporters/admin";

const bodySchema = z.object({ notes: z.string().max(500).optional() });

function errorStatus(error: "not_found" | "already_reviewed") {
  return error === "not_found" ? 404 : 409;
}

async function rejectHandler(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const admin = await getAdminApiUser("admin.supporters");
  if (!admin) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const rateLimit = checkRateLimit("admin", getClientIdentifier(request));
  if (!rateLimit.allowed) return NextResponse.json({ error: "rate_limited" }, { status: 429 });

  const { id } = await params;
  const rawBody = await request.text();
  const payload = bodySchema.safeParse(rawBody ? JSON.parse(rawBody) : {});
  if (!payload.success) return NextResponse.json({ error: "invalid_payload" }, { status: 400 });

  const result = await rejectSupportRequest(admin.id, id, payload.data.notes);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: errorStatus(result.error) });

  return NextResponse.json({ ok: true });
}

export const POST = withApiObservability("admin.support-requests.reject", rejectHandler);
