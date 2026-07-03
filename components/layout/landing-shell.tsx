import type { PropsWithChildren } from "react";
import { LandingHeader } from "@/components/layout/landing-header";
import { Footer } from "@/components/layout/footer";

/** Fase 2 — the public shell: header + content + footer, no sidebar, no bottom nav. Never shown to authenticated users. */
export function LandingShell({ children }: PropsWithChildren) {
  return (
    <div className="mx-auto min-h-screen w-full max-w-7xl space-y-14 px-4 pb-16 pt-4 sm:px-6 lg:px-8">
      <LandingHeader />
      <main id="main-content">{children}</main>
      <Footer />
    </div>
  );
}
