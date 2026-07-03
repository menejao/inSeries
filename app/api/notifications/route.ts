import { NextResponse } from "next/server";
import { getApiUser } from "@/lib/auth/server";
import { countUnreadNotifications, listNotifications } from "@/lib/notifications/service";
import { withApiObservability } from "@/lib/http/api-handler";

async function listHandler() {
  const user = await getApiUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const [items, unreadCount] = await Promise.all([listNotifications(user.id), countUnreadNotifications(user.id)]);

  return NextResponse.json({ data: { items, unreadCount } });
}

export const GET = withApiObservability("notifications.list", listHandler);
