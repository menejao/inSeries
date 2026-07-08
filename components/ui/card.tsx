import { cn } from "@/lib/utils";
import type { ElementType, FormHTMLAttributes, HTMLAttributes, PropsWithChildren } from "react";

type CardProps = PropsWithChildren<HTMLAttributes<HTMLElement> & FormHTMLAttributes<HTMLFormElement>> & {
  interactive?: boolean;
  padding?: "none" | "sm" | "md" | "lg";
  as?: ElementType;
};

const paddingClasses = {
  none: "",
  sm: "p-4",
  md: "p-5",
  lg: "p-6 sm:p-8"
};

export function Card({ children, className, interactive = false, padding = "md", as: Component = "div", ...props }: CardProps) {
  return (
    <Component
      className={cn(
        "rounded-4xl border border-border bg-surface/70 shadow-card backdrop-blur-sm",
        paddingClasses[padding],
        // Fase 8 (INSERIES-DASHBOARD-PREMIUM-01) — -translate-y-1 is the standard hover
        // lift for every interactive card in the app (series-card.tsx, recommendation-
        // card.tsx, dashboard sections); this used to be a smaller -0.5 here, a real
        // inconsistency the "padronizar cards" audit caught and fixed.
        interactive && "transition duration-200 ease-out hover:-translate-y-1 hover:border-border-strong hover:shadow-raised",
        className
      )}
      {...props}
    >
      {children}
    </Component>
  );
}
