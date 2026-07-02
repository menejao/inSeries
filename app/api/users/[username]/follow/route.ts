import { NextResponse } from "next/server";
import { getApiUser } from "@/lib/auth/server";
import { followUserByUsername, unfollowUserByUsername } from "@/lib/social/follow";

export async function POST(request: Request, { params }: { params: Promise<{ username: string }> }) {
  const user = await getApiUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { username } = await params;
  const result = await followUserByUsername(user.id, username);

  if (!result.ok) {
    const status = result.error === "user_not_found" ? 404 : 400;
    return NextResponse.json({ error: result.error }, { status });
  }

  return NextResponse.json({ data: { following: true } });
}

export async function DELETE(request: Request, { params }: { params: Promise<{ username: string }> }) {
  const user = await getApiUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { username } = await params;
  const result = await unfollowUserByUsername(user.id, username);

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 404 });
  }

  return NextResponse.json({ data: { following: false } });
}
