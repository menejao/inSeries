import { NextResponse } from "next/server";
import { getApiUser } from "@/lib/auth/server";
import { createList } from "@/lib/social/lists";
import { createListSchema } from "@/lib/social/validation";
import { withApiObservability } from "@/lib/http/api-handler";

async function createListHandler(request: Request) {
  const user = await getApiUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const payload = createListSchema.safeParse(body);

  if (!payload.success) {
    return NextResponse.json({ error: "invalid_payload" }, { status: 400 });
  }

  const list = await createList(user.id, payload.data);
  return NextResponse.json({ data: list }, { status: 201 });
}

export const POST = withApiObservability("lists.create", createListHandler);
