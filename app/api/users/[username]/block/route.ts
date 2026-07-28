import { NextResponse } from "next/server";
import { getApiUser } from "@/lib/auth/server";
import { blockUser, unblockUser } from "@/lib/social/block";
import { withApiObservability } from "@/lib/http/api-handler";

async function postHandler(request: Request, { params }: { params: Promise<{ username: string }> }) {
  const user = await getApiUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { username } = await params;
  const result = await blockUser(user.id, username);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.error === "user_not_found" ? 404 : 400 });

  return NextResponse.json({ data: { blocked: true } });
}

async function deleteHandler(request: Request, { params }: { params: Promise<{ username: string }> }) {
  const user = await getApiUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { username } = await params;
  const result = await unblockUser(user.id, username);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 404 });

  return NextResponse.json({ data: { blocked: false } });
}

export const POST = withApiObservability("users.block", postHandler);
export const DELETE = withApiObservability("users.unblock", deleteHandler);
