import { NextResponse } from "next/server";
import { getApiUser } from "@/lib/auth/server";
import { removeFollower } from "@/lib/social/follow";
import { withApiObservability } from "@/lib/http/api-handler";

/** Fase 12 — `username` aqui e quem sera removido da lista de seguidores do usuario logado. */
async function postHandler(request: Request, { params }: { params: Promise<{ username: string }> }) {
  const user = await getApiUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { username } = await params;
  const result = await removeFollower(user.id, username);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 404 });

  return NextResponse.json({ data: { ok: true } });
}

export const POST = withApiObservability("users.remove-follower", postHandler);
