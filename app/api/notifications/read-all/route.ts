import { NextResponse } from "next/server";
import { getApiUser } from "@/lib/auth/server";
import { markAllNotificationsRead } from "@/lib/notifications/service";

export async function POST() {
  const user = await getApiUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  await markAllNotificationsRead(user.id);
  return NextResponse.json({ ok: true });
}
