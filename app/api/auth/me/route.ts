import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/server";
import { withApiObservability } from "@/lib/http/api-handler";
import { getSupporterStatus } from "@/lib/supporters/status";

/**
 * INSERIES-SUPPORTER-ACTIVATION-01 — "toda a interface devera consumir apenas essas
 * informacoes": the single `supporter` shape every client-side benefit check reads, instead of
 * each component deriving its own eligibility logic.
 */
async function meHandler() {
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const status = await getSupporterStatus(user.id);

  return NextResponse.json({
    data: {
      ...user,
      supporter: {
        active: status.active,
        startedAt: status.startedAt,
        expiresAt: status.expiresAt,
        showBadge: status.showBadge
      }
    }
  });
}

export const GET = withApiObservability("auth.me", meHandler);
