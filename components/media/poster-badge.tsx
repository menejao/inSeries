import { cn } from "@/lib/utils";
import type { BadgeVariant } from "@/components/ui/badge";
import type { PropsWithChildren, HTMLAttributes } from "react";

/**
 * Fase 5 (INSERIES-DASHBOARD-UX-AND-NAVIGATION-01) — `Badge` (components/ui/badge.tsx) uses a
 * low-opacity tinted background (`bg-primary/12`, etc.), which reads fine on a solid card
 * background but loses reliable contrast when placed directly over a poster/backdrop image —
 * the artwork's own colors show through the tint. `PosterBadge` reuses the same
 * `variant`/color vocabulary as `Badge` but pairs each variant with its SOLID `bg-*` +
 * `text-*-foreground` tokens (the same pair `Button` already uses for AA-contrast text on a
 * solid fill) plus a backdrop-blur, so the badge stays legible regardless of what's behind it.
 * Never use `Badge` directly inside a poster/backdrop overlay — use this instead.
 */
const variantClasses: Record<BadgeVariant, string> = {
  default: "bg-canvas/90 text-ink",
  primary: "bg-primary text-primary-foreground",
  secondary: "bg-secondary text-secondary-foreground",
  success: "bg-success text-success-foreground",
  warning: "bg-warning text-warning-foreground",
  danger: "bg-danger text-danger-foreground",
  outline: "bg-canvas/90 text-ink"
};

type PosterBadgeProps = PropsWithChildren<HTMLAttributes<HTMLSpanElement>> & {
  variant?: BadgeVariant;
};

export function PosterBadge({ children, className, variant = "default", ...props }: PosterBadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold leading-none shadow-sm backdrop-blur",
        variantClasses[variant],
        className
      )}
      {...props}
    >
      {children}
    </span>
  );
}
