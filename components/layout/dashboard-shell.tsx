import type { PropsWithChildren } from "react";
import { getCurrentUser } from "@/lib/auth/server";
import { canAccessAdminWorkspace } from "@/lib/admin/rbac";
import { canAccessRecapWrapped } from "@/lib/recap/window";
import { canAccessSupporterProgram } from "@/lib/supporters/access";
import { Sidebar } from "@/components/layout/sidebar";
import { DashboardHeader } from "@/components/layout/dashboard-header";
import { BottomNav } from "@/components/layout/bottom-nav";
import { CommandPalette } from "@/components/search/command-palette";

/** Fase 2/5/11 — the authenticated shell: fixed sidebar (desktop) + slim header + bottom nav (mobile). Never shown to visitors. */
export async function DashboardShell({ children }: PropsWithChildren) {
  const user = await getCurrentUser();
  const isAdmin = user ? canAccessAdminWorkspace(user.role) : false;
  // INSERIES-RECAP-ENGINE-01 — "fora desse periodo, o menu Recap nao deve existir": computed
  // once here so both Sidebar and BottomNav (which don't otherwise know about the user's role
  // or the current date) can hide the entry identically.
  const recapWrappedAvailable = user ? canAccessRecapWrapped(user.role === "ADMIN") : false;
  // INSERIES-SUPPORTER-SYSTEM-01 — "usuarios comuns nao devem visualizar o acesso ao
  // programa": same hide-the-entry-entirely pattern as Recap Wrapped above.
  const supporterProgramAvailable = user ? canAccessSupporterProgram(user.role) : false;

  return (
    <div className="flex min-h-screen">
      <Sidebar isAdmin={isAdmin} recapWrappedAvailable={recapWrappedAvailable} supporterProgramAvailable={supporterProgramAvailable} />
      {/* min-w-0: sem isso, qualquer scroller horizontal interno (tabs rolaveis etc.) infla a coluna flex e cria scroll horizontal na pagina inteira. */}
      <div className="flex min-h-screen min-w-0 flex-1 flex-col">
        <DashboardHeader />
        <main id="main-content" className="flex-1 px-4 pb-[calc(6rem_+_env(safe-area-inset-bottom))] pt-6 sm:px-6 lg:px-8 lg:pb-10">
          <div className="mx-auto w-full max-w-6xl animate-fade-in">{children}</div>
        </main>
      </div>
      {user ? (
        <BottomNav recapWrappedAvailable={recapWrappedAvailable} supporterProgramAvailable={supporterProgramAvailable} />
      ) : null}
      {user ? <CommandPalette /> : null}
    </div>
  );
}
