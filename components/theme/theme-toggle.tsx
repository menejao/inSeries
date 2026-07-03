"use client";

import { useEffect, useState } from "react";
import { useTheme } from "@/components/theme/theme-provider";
import { MoonIcon, SunIcon } from "@/components/ui/icons";
import { cn } from "@/lib/utils";

/** Quick light/dark flip — used in the public (landing) header, where there's no avatar dropdown to host the full 3-way selector. */
export function ThemeToggle({ className }: { className?: string }) {
  const { resolvedTheme, toggleTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  // The real theme is only knowable client-side (localStorage/matchMedia).
  // SSR always assumes "dark" (see theme-provider's readInitialMode), so we
  // render that same assumption until mount to avoid a hydration mismatch,
  // then switch to the real value.
  useEffect(() => setMounted(true), []);
  const isDark = mounted ? resolvedTheme === "dark" : true;

  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label={isDark ? "Ativar tema claro" : "Ativar tema escuro"}
      title={isDark ? "Ativar tema claro" : "Ativar tema escuro"}
      className={cn(
        "inline-flex h-10 w-10 items-center justify-center rounded-full border border-border text-muted transition hover:border-border-strong hover:text-ink active:scale-95",
        className
      )}
    >
      {isDark ? <SunIcon className="h-5 w-5" /> : <MoonIcon className="h-5 w-5" />}
    </button>
  );
}
