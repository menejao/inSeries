import { NextResponse } from "next/server";
import { getApiUser } from "@/lib/auth/server";
import { deleteComment, updateComment } from "@/lib/social/comments";
import { updateCommentSchema } from "@/lib/social/validation";
import { withApiObservability } from "@/lib/http/api-handler";

function errorStatus(error: "not_found" | "forbidden") {
  return error === "not_found" ? 404 : 403;
}

async function patchHandler(request: Request, { params }: { params: Promise<{ id: string; commentId: string }> }) {
  const user = await getApiUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { commentId } = await params;
  const body = await request.json();
  const payload = updateCommentSchema.safeParse(body);

  if (!payload.success) {
    return NextResponse.json({ error: "invalid_payload" }, { status: 400 });
  }

  const result = await updateComment(user.id, commentId, payload.data.body);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: errorStatus(result.error) });
  }

  return NextResponse.json({ data: result.comment });
}

async function deleteHandler(request: Request, { params }: { params: Promise<{ id: string; commentId: string }> }) {
  const user = await getApiUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { commentId } = await params;
  const result = await deleteComment(user.id, commentId);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: errorStatus(result.error) });
  }

  return NextResponse.json({ data: { ok: true } });
}

export const PATCH = withApiObservability("reviews.comments.update", patchHandler);
export const DELETE = withApiObservability("reviews.comments.delete", deleteHandler);
