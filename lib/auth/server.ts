import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db/prisma";
import { canUseDatabase } from "@/lib/db/health";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/auth/session";

export async function getCurrentSession() {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  return verifySessionToken(token);
}

/**
 * Wrapped in React's per-request `cache()` purely to dedupe the session+DB
 * lookup — several server components in the shell (header, nav, bottom nav,
 * notifications link) call this independently on every render.
 */
export const getCurrentUser = cache(async function getCurrentUser() {
  const session = await getCurrentSession();
  if (!session) return null;
  if (!(await canUseDatabase())) return null;

  return prisma.user.findUnique({
    where: { id: session.sub },
    select: {
      id: true,
      name: true,
      username: true,
      email: true,
      avatarUrl: true,
      bio: true,
      role: true
    }
  });
});

export async function requireUser() {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }
  return user;
}

export async function getApiUser() {
  return getCurrentUser();
}
