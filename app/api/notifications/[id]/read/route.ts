import { NextResponse } from "next/server";
import { getApiUser } from "@/lib/auth/server";
import { markNotificationRead } from "@/lib/notifications/service";
import { withApiObservability } from "@/lib/http/api-handler";

async function readHandler(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getApiUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const result = await markNotificationRead(user.id, id);

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.error === "forbidden" ? 403 : 404 });
  }

  return NextResponse.json({ ok: true });
}

export const POST = withApiObservability("notifications.read", readHandler);
