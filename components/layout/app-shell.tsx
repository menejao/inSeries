import type { PropsWithChildren } from "react";
import { getCurrentUser } from "@/lib/auth/server";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { LandingShell } from "@/components/layout/landing-shell";

/**
 * Fase 1/2 — the single fork point between the two products: visitors get
 * LandingShell (public header + footer, no app navigation); authenticated
 * users get DashboardShell (sidebar + minimal header + bottom nav). Neither
 * shell shares navigation with the other, per the ticket's principle.
 */
export async function AppShell({ children }: PropsWithChildren) {
  const user = await getCurrentUser();
  return user ? <DashboardShell>{children}</DashboardShell> : <LandingShell>{children}</LandingShell>;
}
