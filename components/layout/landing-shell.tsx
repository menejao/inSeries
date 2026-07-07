import type { PropsWithChildren } from "react";
import { LandingHeader } from "@/components/layout/landing-header";
import { Footer } from "@/components/layout/footer";

/**
 * Fase 2 — the public shell: header + content + footer, no sidebar, no bottom nav. Never
 * shown to authenticated users.
 *
 * Fase 2/5 (INSERIES-LANDING-CINEMATIC-IMMERSION-01) — `LandingHeader` is now `fixed`
 * (floats transparently over the Landing page's Hero, see landing-header.tsx), so it no
 * longer occupies flow space. The `pt-24` below is this shell's replacement clearance —
 * every page that isn't the Landing's Hero (login, register, catalog, series detail, ...)
 * needs it so its content doesn't start hidden underneath the fixed header. The Landing
 * page's Hero cancels this same `pt-24` with a matching negative margin to reclaim the
 * full viewport for its full-bleed backdrop — see components/landing/cinematic-hero.tsx.
 * `overflow-x-clip` contains the Hero's full-bleed breakout (`100vw` via negative margin)
 * so it can never introduce a page-wide horizontal scrollbar.
 */
export function LandingShell({ children }: PropsWithChildren) {
  return (
    <div className="min-h-screen w-full overflow-x-clip">
      <LandingHeader />
      <div className="mx-auto w-full max-w-7xl space-y-14 px-4 pb-16 pt-24 sm:px-6 lg:px-8">
        <main id="main-content">{children}</main>
        <Footer />
      </div>
    </div>
  );
}
