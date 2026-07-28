import { NextResponse } from "next/server";
import { getApiUser } from "@/lib/auth/server";
import { deleteActivityComment, updateActivityComment } from "@/lib/social/activity-comments";
import { updateCommentSchema } from "@/lib/social/validation";
import { withApiObservability } from "@/lib/http/api-handler";

function errorStatus(error: "not_found" | "forbidden" | "invalid_body") {
  if (error === "not_found") return 404;
  if (error === "forbidden") return 403;
  return 400;
}

async function patchHandler(request: Request, { params }: { params: Promise<{ id: string; commentId: string }> }) {
  const user = await getApiUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { commentId } = await params;
  const body = await request.json();
  const payload = updateCommentSchema.safeParse(body);
  if (!payload.success) return NextResponse.json({ error: "invalid_payload" }, { status: 400 });

  const result = await updateActivityComment(user.id, commentId, payload.data.body);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: errorStatus(result.error) });

  return NextResponse.json({ data: result.comment });
}

async function deleteHandler(request: Request, { params }: { params: Promise<{ id: string; commentId: string }> }) {
  const user = await getApiUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { commentId } = await params;
  const result = await deleteActivityComment(user.id, commentId);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: errorStatus(result.error) });

  return NextResponse.json({ data: { ok: true } });
}

export const PATCH = withApiObservability("activities.comments.update", patchHandler);
export const DELETE = withApiObservability("activities.comments.delete", deleteHandler);
