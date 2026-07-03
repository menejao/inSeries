import { NextResponse } from "next/server";
import { getApiUser } from "@/lib/auth/server";
import { deleteList, updateList } from "@/lib/social/lists";
import { updateListSchema } from "@/lib/social/validation";
import { withApiObservability } from "@/lib/http/api-handler";

function errorStatus(error: "not_found" | "forbidden") {
  return error === "not_found" ? 404 : 403;
}

async function patchHandler(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getApiUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const body = await request.json();
  const payload = updateListSchema.safeParse(body);

  if (!payload.success) {
    return NextResponse.json({ error: "invalid_payload" }, { status: 400 });
  }

  const result = await updateList(id, user.id, payload.data);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: errorStatus(result.error) });
  }

  return NextResponse.json({ data: result.list });
}

async function deleteHandler(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getApiUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const result = await deleteList(id, user.id);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: errorStatus(result.error) });
  }

  return NextResponse.json({ data: { ok: true } });
}

export const PATCH = withApiObservability("lists.update", patchHandler);
export const DELETE = withApiObservability("lists.delete", deleteHandler);
