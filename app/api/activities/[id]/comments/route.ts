import { NextResponse } from "next/server";
import { getApiUser } from "@/lib/auth/server";
import { createActivityComment, getActivityComments } from "@/lib/social/activity-comments";
import { commentSchema } from "@/lib/social/validation";
import { withApiObservability } from "@/lib/http/api-handler";

function errorStatus(error: "not_found" | "invalid_parent" | "invalid_body" | "blocked") {
  if (error === "not_found") return 404;
  if (error === "blocked") return 403;
  return 400;
}

async function getHandler(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getApiUser();
  const { id } = await params;
  const comments = await getActivityComments(id, user?.id ?? null);
  return NextResponse.json({ data: comments });
}

async function postHandler(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getApiUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = await request.json();
  const payload = commentSchema.safeParse(body);
  if (!payload.success) return NextResponse.json({ error: "invalid_payload" }, { status: 400 });

  const result = await createActivityComment(user.id, id, payload.data.body, payload.data.parentId);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: errorStatus(result.error) });

  return NextResponse.json({ data: result.comment }, { status: 201 });
}

export const GET = withApiObservability("activities.comments.list", getHandler);
export const POST = withApiObservability("activities.comments.create", postHandler);
