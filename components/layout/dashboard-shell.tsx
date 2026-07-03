import type { PropsWithChildren } from "react";
import { getCurrentUser } from "@/lib/auth/server";
import { canAccessAdminWorkspace } from "@/lib/admin/rbac";
import { Sidebar } from "@/components/layout/sidebar";
import { DashboardHeader } from "@/components/layout/dashboard-header";
import { BottomNav } from "@/components/layout/bottom-nav";

/** Fase 2/5/11 — the authenticated shell: fixed sidebar (desktop) + slim header + bottom nav (mobile). Never shown to visitors. */
export async function DashboardShell({ children }: PropsWithChildren) {
  const user = await getCurrentUser();
  const isAdmin = user ? canAccessAdminWorkspace(user.role) : false;

  return (
    <div className="flex min-h-screen">
      <Sidebar isAdmin={isAdmin} />
      <div className="flex min-h-screen flex-1 flex-col">
        <DashboardHeader />
        <main id="main-content" className="flex-1 px-4 pb-28 pt-6 sm:px-6 lg:px-8 lg:pb-10">
          <div className="mx-auto w-full max-w-6xl animate-fade-in">{children}</div>
        </main>
      </div>
      {user ? <BottomNav username={user.username} /> : null}
    </div>
  );
}
