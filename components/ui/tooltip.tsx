import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

const sideClasses = {
  top: "bottom-full left-1/2 -translate-x-1/2 mb-2",
  bottom: "top-full left-1/2 -translate-x-1/2 mt-2",
  left: "right-full top-1/2 -translate-y-1/2 mr-2",
  right: "left-full top-1/2 -translate-y-1/2 ml-2"
};

/**
 * CSS-only tooltip (no JS state): shows on hover *and* keyboard focus via
 * `group-focus-within`, so it never traps or requires pointer input.
 * `children` must be a single focusable/hoverable element (button, link).
 */
export function Tooltip({ content, children, side = "top" }: { content: string; children: ReactNode; side?: keyof typeof sideClasses }) {
  return (
    <span className="group relative inline-flex">
      {children}
      <span
        role="tooltip"
        className={cn(
          "pointer-events-none absolute z-40 whitespace-nowrap rounded-lg bg-surface-strong px-2.5 py-1.5 text-xs font-medium text-ink opacity-0 shadow-raised transition delay-150 duration-100",
          "group-hover:opacity-100 group-focus-within:opacity-100",
          sideClasses[side]
        )}
      >
        {content}
      </span>
    </span>
  );
}
