import { cn } from "@/lib/utils";
import type { HTMLAttributes, PropsWithChildren } from "react";

export function Card({ children, className, ...props }: PropsWithChildren<HTMLAttributes<HTMLDivElement>>) {
  return (
    <div
      className={cn(
        "rounded-4xl border border-white/10 bg-slate-950/55 p-5 shadow-card backdrop-blur",
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}
