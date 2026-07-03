import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/server";
import { withApiObservability } from "@/lib/http/api-handler";

async function meHandler() {
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  return NextResponse.json({ data: user });
}

export const GET = withApiObservability("auth.me", meHandler);
