"use client";

import { createPortal } from "react-dom";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { XIcon } from "@/components/ui/icons";
import { IconButton } from "@/components/ui/button";

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

type DialogProps = {
  open: boolean;
  onClose: () => void;
  title?: string;
  description?: string;
  children?: ReactNode;
  footer?: ReactNode;
  className?: string;
  /** "md" (default, max-w-md) preserves every existing call site; "lg" (max-w-2xl) is for content-heavy dialogs like the Command Palette. */
  size?: "md" | "lg";
  /** Drops the default p-6 so children control their own spacing (e.g. a full-bleed search input). Defaults to true (existing behavior). */
  padded?: boolean;
};

const sizeClasses = { md: "max-w-md", lg: "max-w-2xl" };

export function Dialog({ open, onClose, title, description, children, footer, className, size = "md", padded = true }: DialogProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!open) return;

    const previouslyFocused = document.activeElement as HTMLElement | null;
    const panel = panelRef.current;
    const focusable = panel?.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR);
    (focusable?.[0] ?? panel)?.focus();

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
        return;
      }
      if (event.key !== "Tab" || !panel) return;

      const items = Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR));
      if (items.length === 0) return;
      const first = items[0];
      const last = items[items.length - 1];

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = previousOverflow;
      previouslyFocused?.focus();
    };
  }, [open, onClose]);

  if (!mounted || !open) return null;

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 animate-fade-in bg-overlay/70 backdrop-blur-sm" onClick={onClose} aria-hidden="true" />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? "dialog-title" : undefined}
        aria-describedby={description ? "dialog-description" : undefined}
        tabIndex={-1}
        className={cn(
          "relative z-10 w-full animate-scale-in rounded-4xl border border-border bg-surface-strong shadow-raised",
          sizeClasses[size],
          padded && "p-6",
          className
        )}
      >
        <IconButton label="Fechar" size="sm" onClick={onClose} className="absolute right-4 top-4">
          <XIcon className="h-4 w-4" />
        </IconButton>
        {title ? (
          <h2 id="dialog-title" className="pr-8 text-lg font-semibold text-ink">
            {title}
          </h2>
        ) : null}
        {description ? (
          <p id="dialog-description" className="mt-1 text-sm text-muted">
            {description}
          </p>
        ) : null}
        {children ? <div className={cn(title || description ? "mt-4" : undefined)}>{children}</div> : null}
        {footer ? <div className="mt-6 flex flex-wrap justify-end gap-3">{footer}</div> : null}
      </div>
    </div>,
    document.body
  );
}
