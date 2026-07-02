import { cn } from "@/lib/utils";
import type { ButtonHTMLAttributes, PropsWithChildren } from "react";

type ButtonProps = PropsWithChildren<ButtonHTMLAttributes<HTMLButtonElement>> & {
  variant?: "primary" | "secondary" | "ghost";
};

export function Button({ children, className, variant = "primary", ...props }: ButtonProps) {
  const variants = {
    primary: "bg-ember text-night hover:bg-orange-400",
    secondary: "border border-slate-600 bg-slate-900/70 text-ink hover:bg-slate-800",
    ghost: "bg-transparent text-slate-200 hover:bg-white/5"
  };

  return (
    <button
      className={cn(
        "inline-flex min-h-11 items-center justify-center rounded-full px-4 text-sm font-semibold transition focus:outline-none focus:ring-2 focus:ring-ember/50",
        variants[variant],
        className
      )}
      {...props}
    >
      {children}
    </button>
  );
}
