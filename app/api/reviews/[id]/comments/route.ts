import { NextResponse } from "next/server";
import { getApiUser } from "@/lib/auth/server";
import { createComment } from "@/lib/social/comments";
import { commentSchema } from "@/lib/social/validation";
import { withApiObservability } from "@/lib/http/api-handler";

function errorStatus(error: "not_found" | "invalid_parent") {
  return error === "not_found" ? 404 : 400;
}

async function postHandler(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getApiUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const body = await request.json();
  const payload = commentSchema.safeParse(body);

  if (!payload.success) {
    return NextResponse.json({ error: "invalid_payload" }, { status: 400 });
  }

  const result = await createComment(user.id, id, payload.data.body, payload.data.parentId);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: errorStatus(result.error) });
  }

  return NextResponse.json({ data: result.comment }, { status: 201 });
}

export const POST = withApiObservability("reviews.comments.create", postHandler);
