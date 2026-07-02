import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type { UserRole } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { canUseDatabase } from "@/lib/db/health";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/auth/session";

export type Permission =
  | "admin.read"
  | "admin.catalog"
  | "admin.sync"
  | "admin.users"
  | "admin.reviews"
  | "admin.lists"
  | "admin.system";

const ROLE_PERMISSIONS: Record<UserRole, Permission[]> = {
  USER: [],
  MODERATOR: ["admin.read", "admin.reviews", "admin.lists"],
  ADMIN: ["admin.read", "admin.catalog", "admin.sync", "admin.users", "admin.reviews", "admin.lists", "admin.system"]
};

export function getPermissionsForRole(role: UserRole): Permission[] {
  return ROLE_PERMISSIONS[role] ?? [];
}

export function hasPermission(role: UserRole, permission: Permission): boolean {
  return getPermissionsForRole(role).includes(permission);
}

export function canAccessAdminWorkspace(role: UserRole): boolean {
  return getPermissionsForRole(role).length > 0;
}

export type AdminUser = {
  id: string;
  name: string;
  username: string;
  email: string;
  role: UserRole;
};

// Deliberately separate from lib/auth/server.ts's getCurrentUser(), which is
// used pervasively across the app and does not select `role`. Admin RBAC
// always re-verifies the role live from the database — the session token's
// role claim is only used as a fast, edge-compatible pre-check in middleware.
export async function getCurrentAdminUser(): Promise<AdminUser | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  const session = await verifySessionToken(token);
  if (!session) return null;
  if (!(await canUseDatabase())) return null;

  const user = await prisma.user.findUnique({
    where: { id: session.sub },
    select: { id: true, name: true, username: true, email: true, role: true }
  });

  if (!user || !canAccessAdminWorkspace(user.role)) {
    return null;
  }

  return user;
}

export async function requireAdminUser(permission?: Permission): Promise<AdminUser> {
  const user = await getCurrentAdminUser();
  if (!user) {
    redirect("/");
  }
  if (permission && !hasPermission(user.role, permission)) {
    redirect("/admin");
  }
  return user;
}

export async function getAdminApiUser(permission?: Permission): Promise<AdminUser | null> {
  const user = await getCurrentAdminUser();
  if (!user) return null;
  if (permission && !hasPermission(user.role, permission)) return null;
  return user;
}
