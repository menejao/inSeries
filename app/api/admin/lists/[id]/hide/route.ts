import { NextResponse } from "next/server";
import { getAdminApiUser } from "@/lib/admin/rbac";
import { hideList } from "@/lib/admin/moderation";
import { withApiObservability } from "@/lib/http/api-handler";
import { checkRateLimit, getClientIdentifier } from "@/lib/rate-limit";

async function hideHandler(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const admin = await getAdminApiUser("admin.lists");
  if (!admin) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const rateLimit = checkRateLimit("admin", getClientIdentifier(request));
  if (!rateLimit.allowed) {
    return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  }

  const { id } = await params;
  const result = await hideList(admin.id, id);

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}

export const POST = withApiObservability("admin.lists.hide", hideHandler);
