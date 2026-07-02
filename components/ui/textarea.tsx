import { cn } from "@/lib/utils";
import type { TextareaHTMLAttributes } from "react";

export function Textarea({ className, ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      className={cn(
        "w-full min-h-28 rounded-2xl border border-white/10 bg-slate-950/60 px-4 py-3 text-sm text-ink outline-none placeholder:text-slate-400 focus:border-ember/60",
        className
      )}
      {...props}
    />
  );
}
