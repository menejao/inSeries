import { NextResponse } from "next/server";
import { getApiUser } from "@/lib/auth/server";
import { deleteReview, upsertReview } from "@/lib/social/reviews";
import { reviewSchema } from "@/lib/social/validation";
import { withApiObservability } from "@/lib/http/api-handler";

async function postHandler(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getApiUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const body = await request.json();
  const payload = reviewSchema.safeParse(body);

  if (!payload.success) {
    return NextResponse.json({ error: "invalid_payload" }, { status: 400 });
  }

  const result = await upsertReview(user.id, id, payload.data);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 404 });
  }

  return NextResponse.json({ data: result.review });
}

async function deleteHandler(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getApiUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  await deleteReview(user.id, id);
  return NextResponse.json({ data: { ok: true } });
}

export const POST = withApiObservability("series.reviews.upsert", postHandler);
export const DELETE = withApiObservability("series.reviews.delete", deleteHandler);
