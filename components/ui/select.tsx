import { cn } from "@/lib/utils";
import type { SelectHTMLAttributes } from "react";

export function Select({ className, ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      className={cn(
        "min-h-11 w-full rounded-2xl border border-white/10 bg-slate-950/60 px-4 text-sm text-ink outline-none focus:border-ember/60",
        className
      )}
      {...props}
    />
  );
}
