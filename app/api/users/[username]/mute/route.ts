import { NextResponse } from "next/server";
import { getApiUser } from "@/lib/auth/server";
import { muteUser, unmuteUser } from "@/lib/social/mute";
import { withApiObservability } from "@/lib/http/api-handler";

async function postHandler(request: Request, { params }: { params: Promise<{ username: string }> }) {
  const user = await getApiUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { username } = await params;
  const result = await muteUser(user.id, username);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.error === "user_not_found" ? 404 : 400 });

  return NextResponse.json({ data: { muted: true } });
}

async function deleteHandler(request: Request, { params }: { params: Promise<{ username: string }> }) {
  const user = await getApiUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { username } = await params;
  const result = await unmuteUser(user.id, username);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 404 });

  return NextResponse.json({ data: { muted: false } });
}

export const POST = withApiObservability("users.mute", postHandler);
export const DELETE = withApiObservability("users.unmute", deleteHandler);
