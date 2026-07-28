import { NextResponse } from "next/server";
import { getApiUser } from "@/lib/auth/server";
import { searchUsers } from "@/lib/social/affinity";
import { withApiObservability } from "@/lib/http/api-handler";

async function getHandler(request: Request) {
  const user = await getApiUser();
  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q") ?? "";
  const results = await searchUsers(user?.id ?? null, q);
  return NextResponse.json({ data: results });
}

export const GET = withApiObservability("users.search", getHandler);
