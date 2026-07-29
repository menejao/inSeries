import { NextResponse } from "next/server";
import { z } from "zod";
import { getApiUser } from "@/lib/auth/server";
import { prisma } from "@/lib/db/prisma";
import { withApiObservability } from "@/lib/http/api-handler";
import { getSupporterStatus } from "@/lib/supporters/status";

const preferencesSchema = z.object({
  showSupporterBadge: z.boolean().optional(),
  supporterBannerStyle: z.string().max(40).nullable().optional(),
  supporterFrameStyle: z.string().max(40).nullable().optional()
});

/** INSERIES-SUPPORTER-ACTIVATION-01 — badge visibility toggle + cosmetic banner/frame choice. Only ever touches a supporter's own preferences, never grants supporter status itself. */
async function preferencesHandler(request: Request) {
  const user = await getApiUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const status = await getSupporterStatus(user.id);
  if (!status.active) return NextResponse.json({ error: "not_a_supporter" }, { status: 403 });

  const body = await request.json();
  const payload = preferencesSchema.safeParse(body);
  if (!payload.success) return NextResponse.json({ error: "invalid_payload" }, { status: 400 });

  const updated = await prisma.user.update({
    where: { id: user.id },
    data: payload.data,
    select: { showSupporterBadge: true, supporterBannerStyle: true, supporterFrameStyle: true }
  });

  return NextResponse.json({ data: updated });
}

export const PATCH = withApiObservability("support.preferences", preferencesHandler);
