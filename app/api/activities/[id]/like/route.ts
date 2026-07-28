import { NextResponse } from "next/server";
import { getApiUser } from "@/lib/auth/server";
import { likeActivity, unlikeActivity } from "@/lib/social/activity-likes";
import { withApiObservability } from "@/lib/http/api-handler";

async function postHandler(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getApiUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { id } = await params;
  const result = await likeActivity(user.id, id);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.error === "not_found" ? 404 : 400 });

  return NextResponse.json({ data: { liked: result.liked, count: result.count } });
}

async function deleteHandler(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getApiUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { id } = await params;
  const result = await unlikeActivity(user.id, id);
  return NextResponse.json({ data: { liked: result.liked, count: result.count } });
}

export const POST = withApiObservability("activities.like", postHandler);
export const DELETE = withApiObservability("activities.unlike", deleteHandler);
