import { NextResponse } from "next/server";
import { z } from "zod";
import { getApiUser } from "@/lib/auth/server";
import { withApiObservability } from "@/lib/http/api-handler";
import { canAccessSupporterProgram } from "@/lib/supporters/access";
import { confirmContribution } from "@/lib/supporters/service";

const confirmSchema = z.object({ contributionId: z.string().min(1) });

async function confirmHandler(request: Request) {
  const user = await getApiUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!canAccessSupporterProgram(user.role)) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const body = await request.json();
  const payload = confirmSchema.safeParse(body);
  if (!payload.success) return NextResponse.json({ error: "invalid_payload" }, { status: 400 });

  const result = await confirmContribution(user.id, payload.data.contributionId);
  if (!result.ok) return NextResponse.json({ error: "not_found" }, { status: 404 });

  return NextResponse.json({ data: { ok: true } });
}

export const POST = withApiObservability("support.confirm", confirmHandler);
