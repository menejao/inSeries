import { NextResponse } from "next/server";
import { z } from "zod";
import { getApiUser } from "@/lib/auth/server";
import { prisma } from "@/lib/db/prisma";
import { withApiObservability } from "@/lib/http/api-handler";

const createPollSchema = z.object({
  question: z.string().trim().min(3).max(200),
  options: z.array(z.string().trim().min(1).max(80)).min(2).max(6)
});

/** INSERIES-SUPPORTER-SYSTEM-01 — minimal admin creation endpoint for supporter polls (no dedicated admin UI yet, first version). */
async function createPollHandler(request: Request) {
  const admin = await getApiUser();
  if (!admin || admin.role !== "ADMIN") return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const body = await request.json();
  const payload = createPollSchema.safeParse(body);
  if (!payload.success) return NextResponse.json({ error: "invalid_payload" }, { status: 400 });

  const poll = await prisma.supporterPoll.create({
    data: { question: payload.data.question, options: payload.data.options }
  });

  return NextResponse.json({ data: poll }, { status: 201 });
}

export const POST = withApiObservability("admin.supporter-polls.create", createPollHandler);
