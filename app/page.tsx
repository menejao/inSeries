import { getCurrentUser } from "@/lib/auth/server";
import { LandingPage } from "@/components/landing/landing-page";
import { DashboardHome } from "@/components/dashboard/dashboard-home";

/** Fase 3/4 — "/" is two completely different products depending on auth: full marketing Landing, or the Dashboard Home. */
export default async function RootPage() {
  const user = await getCurrentUser();
  return user ? <DashboardHome user={user} /> : <LandingPage />;
}
