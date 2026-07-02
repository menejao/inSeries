import { NextResponse } from "next/server";
import { getApiUser } from "@/lib/auth/server";
import { addListItem } from "@/lib/social/lists";
import { addListItemSchema } from "@/lib/social/validation";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getApiUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const body = await request.json();
  const payload = addListItemSchema.safeParse(body);

  if (!payload.success) {
    return NextResponse.json({ error: "invalid_payload" }, { status: 400 });
  }

  const result = await addListItem(id, user.id, payload.data.seriesId, payload.data.note);

  if (!result.ok) {
    const status = result.error === "not_found" ? 404 : result.error === "forbidden" ? 403 : 400;
    return NextResponse.json({ error: result.error }, { status });
  }

  return NextResponse.json({ data: result.item }, { status: 201 });
}
