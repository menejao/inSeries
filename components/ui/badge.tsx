import { cn } from "@/lib/utils";
import type { HTMLAttributes, PropsWithChildren } from "react";

export function Badge({ children, className, ...props }: PropsWithChildren<HTMLAttributes<HTMLSpanElement>>) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border border-ember/30 bg-ember/10 px-3 py-1 text-xs font-medium text-amber-100",
        className
      )}
      {...props}
    >
      {children}
    </span>
  );
}
