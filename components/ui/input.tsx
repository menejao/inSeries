import { cn } from "@/lib/utils";
import type { InputHTMLAttributes } from "react";

export function Input({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cn(
        "min-h-11 w-full rounded-2xl border border-white/10 bg-slate-950/60 px-4 text-sm text-ink outline-none placeholder:text-slate-400 focus:border-ember/60",
        className
      )}
      {...props}
    />
  );
}
