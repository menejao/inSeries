import { cn } from "@/lib/utils";
import type { HTMLAttributes, PropsWithChildren } from "react";

export type BadgeVariant = "default" | "primary" | "secondary" | "success" | "warning" | "danger" | "outline";

const variantClasses: Record<BadgeVariant, string> = {
  default: "border-border bg-surface-strong text-muted",
  primary: "border-primary/25 bg-primary/12 text-primary-text",
  secondary: "border-secondary/25 bg-secondary/12 text-secondary-text",
  success: "border-success/25 bg-success/12 text-success-text",
  warning: "border-warning/25 bg-warning/12 text-warning-text",
  danger: "border-danger/25 bg-danger/12 text-danger-text",
  outline: "border-border text-ink"
};

type BadgeProps = PropsWithChildren<HTMLAttributes<HTMLSpanElement>> & {
  variant?: BadgeVariant;
};

export function Badge({ children, className, variant = "primary", ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-medium leading-none",
        variantClasses[variant],
        className
      )}
      {...props}
    >
      {children}
    </span>
  );
}
