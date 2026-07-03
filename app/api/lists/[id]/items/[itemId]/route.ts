import { NextResponse } from "next/server";
import { getApiUser } from "@/lib/auth/server";
import { removeListItem, reorderListItem } from "@/lib/social/lists";
import { reorderListItemSchema } from "@/lib/social/validation";
import { withApiObservability } from "@/lib/http/api-handler";

function errorStatus(error: "not_found" | "forbidden") {
  return error === "not_found" ? 404 : 403;
}

async function deleteHandler(request: Request, { params }: { params: Promise<{ id: string; itemId: string }> }) {
  const user = await getApiUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { id, itemId } = await params;
  const result = await removeListItem(id, user.id, itemId);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: errorStatus(result.error) });
  }

  return NextResponse.json({ data: { ok: true } });
}

async function patchHandler(request: Request, { params }: { params: Promise<{ id: string; itemId: string }> }) {
  const user = await getApiUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { id, itemId } = await params;
  const body = await request.json();
  const payload = reorderListItemSchema.safeParse(body);

  if (!payload.success) {
    return NextResponse.json({ error: "invalid_payload" }, { status: 400 });
  }

  const result = await reorderListItem(id, user.id, itemId, payload.data.direction);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: errorStatus(result.error) });
  }

  return NextResponse.json({ data: { ok: true } });
}

export const DELETE = withApiObservability("lists.items.remove", deleteHandler);
export const PATCH = withApiObservability("lists.items.reorder", patchHandler);
