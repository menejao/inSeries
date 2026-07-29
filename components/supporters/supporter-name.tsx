import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * INSERIES-SUPPORTER-SYSTEM-01 — "pequeno destaque visual no nome... sem exageros": a subtle
 * gradient text treatment, opt-in per render site (never applied automatically to every
 * `isSupporter` user in every context — callers pass `active` explicitly, same pattern as
 * SupporterBadge).
 */
export function SupporterName({ active, children, className }: { active: boolean; children: ReactNode; className?: string }) {
  if (!active) return <>{children}</>;
  return (
    <span className={cn("bg-gradient-to-r from-primary via-danger to-primary bg-clip-text font-semibold text-transparent", className)}>
      {children}
    </span>
  );
}
