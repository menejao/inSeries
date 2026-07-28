import { NextResponse } from "next/server";
import { getApiUser } from "@/lib/auth/server";
import { rejectFollowRequest } from "@/lib/social/follow";
import { withApiObservability } from "@/lib/http/api-handler";

async function postHandler(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getApiUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { id } = await params;
  const result = await rejectFollowRequest(user.id, id);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 404 });

  return NextResponse.json({ data: { ok: true } });
}

export const POST = withApiObservability("follow-requests.reject", postHandler);
