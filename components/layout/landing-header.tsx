"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const SCROLL_THRESHOLD = 60;

/**
 * Fase 2/5 (INSERIES-LANDING-CINEMATIC-IMMERSION-01) — overlays the Hero transparently
 * ("navbar transparente sobreposta"); once the visitor scrolls past the threshold, fades
 * smoothly to a solid background ("transição suave para fundo sólido"). Fixed (not sticky)
 * so it stays visible at all times on every public page, not just the Landing —
 * `LandingShell` compensates with matching top padding so non-Hero pages (login/register/
 * catalog/etc.) are never hidden underneath it; the Landing page's Hero cancels that same
 * padding to reclaim the full viewport for its full-bleed backdrop.
 */
export function LandingHeader() {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    function onScroll() {
      setScrolled(window.scrollY > SCROLL_THRESHOLD);
    }
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className={cn(
        "safe-pt fixed inset-x-0 top-0 z-50 flex h-20 items-center justify-between gap-4 px-4 transition-colors duration-300 sm:px-6 lg:px-8",
        scrolled ? "border-b border-border bg-canvas/85 backdrop-blur-md" : "border-b border-transparent bg-transparent"
      )}
    >
      <Link href="/" className="flex items-center gap-3">
        <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary text-lg font-black text-primary-foreground">
          in
        </span>
        <span className="hidden sm:block">
          <span className="block text-lg font-semibold leading-tight text-ink">inSeries</span>
          <span className="block text-xs text-muted">Suas series, episodio por episodio</span>
        </span>
      </Link>
      <div className="flex items-center gap-2">
        <ThemeToggle />
        <Link href="/login" className={buttonVariants({ variant: "ghost", size: "sm" })}>
          Entrar
        </Link>
        <Link href="/register" className={buttonVariants({ variant: "primary", size: "sm" })}>
          Criar conta
        </Link>
      </div>
    </header>
  );
}
