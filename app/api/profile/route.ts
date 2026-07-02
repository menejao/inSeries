import { NextResponse } from "next/server";
import { getApiUser } from "@/lib/auth/server";
import { prisma } from "@/lib/db/prisma";
import { profileUpdateSchema } from "@/lib/social/validation";

export async function PATCH(request: Request) {
  const user = await getApiUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const payload = profileUpdateSchema.safeParse(body);

  if (!payload.success) {
    return NextResponse.json({ error: "invalid_payload" }, { status: 400 });
  }

  const { username, ...rest } = payload.data;

  if (username) {
    const existing = await prisma.user.findUnique({ where: { username } });
    if (existing && existing.id !== user.id) {
      return NextResponse.json({ error: "username_taken" }, { status: 409 });
    }
  }

  const updated = await prisma.user.update({
    where: { id: user.id },
    data: {
      ...rest,
      ...(username ? { username } : {}),
      ...(rest.avatarUrl === "" ? { avatarUrl: null } : {})
    },
    select: {
      id: true,
      name: true,
      username: true,
      email: true,
      bio: true,
      avatarUrl: true,
      isProfilePrivate: true,
      showWatchedSeries: true,
      showWatchingSeries: true,
      showLists: true,
      showReviews: true,
      showActivity: true
    }
  });

  return NextResponse.json({ data: updated });
}
