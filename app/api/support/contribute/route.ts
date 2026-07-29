import { NextResponse } from "next/server";
import { z } from "zod";
import { getApiUser } from "@/lib/auth/server";
import { withApiObservability } from "@/lib/http/api-handler";
import { canAccessSupporterProgram } from "@/lib/supporters/access";
import { startContribution } from "@/lib/supporters/service";

const contributeSchema = z.object({ amountCents: z.number().int().min(100).max(100000) });

async function contributeHandler(request: Request) {
  const user = await getApiUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!canAccessSupporterProgram(user.role)) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const body = await request.json();
  const payload = contributeSchema.safeParse(body);
  if (!payload.success) return NextResponse.json({ error: "invalid_payload" }, { status: 400 });

  const result = await startContribution(user.id, payload.data.amountCents);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });

  return NextResponse.json({ data: { contributionId: result.contributionId, pixPayload: result.pixPayload } });
}

export const POST = withApiObservability("support.contribute", contributeHandler);
