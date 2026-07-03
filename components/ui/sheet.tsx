"use client";

import { createPortal } from "react-dom";
import { useEffect, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";

type SheetProps = {
  open: boolean;
  onClose: () => void;
  title?: string;
  children?: ReactNode;
  className?: string;
};

/** Bottom sheet for mobile-first flows (e.g. filters). Shares Dialog's escape/backdrop-close contract. */
export function Sheet({ open, onClose, title, children, className }: SheetProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [open, onClose]);

  if (!mounted || !open) return null;

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-4">
      <div className="absolute inset-0 animate-fade-in bg-overlay/70 backdrop-blur-sm" onClick={onClose} aria-hidden="true" />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={cn(
          "safe-pb relative z-10 max-h-[85vh] w-full animate-slide-up overflow-y-auto rounded-t-4xl border border-border bg-surface-strong p-6 shadow-raised",
          "sm:max-w-lg sm:animate-scale-in sm:rounded-4xl",
          className
        )}
      >
        <div className="mx-auto mb-4 h-1.5 w-12 rounded-full bg-border-strong sm:hidden" aria-hidden="true" />
        {title ? <h2 className="text-lg font-semibold text-ink">{title}</h2> : null}
        <div className={title ? "mt-4" : undefined}>{children}</div>
      </div>
    </div>,
    document.body
  );
}
