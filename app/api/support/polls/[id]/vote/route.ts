import { NextResponse } from "next/server";
import { z } from "zod";
import { getApiUser } from "@/lib/auth/server";
import { withApiObservability } from "@/lib/http/api-handler";
import { canAccessSupporterProgram } from "@/lib/supporters/access";
import { getSupporterStatus } from "@/lib/supporters/status";
import { voteOnPoll } from "@/lib/supporters/polls";

const voteSchema = z.object({ optionIndex: z.number().int().min(0) });

async function voteHandler(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getApiUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!canAccessSupporterProgram(user.role)) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const status = await getSupporterStatus(user.id);
  if (!status.active) return NextResponse.json({ error: "not_a_supporter" }, { status: 403 });

  const { id } = await params;
  const body = await request.json();
  const payload = voteSchema.safeParse(body);
  if (!payload.success) return NextResponse.json({ error: "invalid_payload" }, { status: 400 });

  const result = await voteOnPoll(user.id, id, payload.data.optionIndex);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });

  return NextResponse.json({ data: { ok: true } });
}

export const POST = withApiObservability("support.polls.vote", voteHandler);
