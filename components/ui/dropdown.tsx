"use client";

import Link from "next/link";
import {
  cloneElement,
  isValidElement,
  useEffect,
  useRef,
  useState,
  type ButtonHTMLAttributes,
  type ReactElement,
  type ReactNode
} from "react";
import { cn } from "@/lib/utils";

type DropdownProps = {
  trigger: ReactElement<Record<string, unknown>>;
  children: ReactNode;
  align?: "start" | "end";
};

export function Dropdown({ trigger, children, align = "end" }: DropdownProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;

    function handlePointerDown(event: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  const triggerWithProps = isValidElement(trigger)
    ? cloneElement(trigger, {
        onClick: () => setOpen((value) => !value),
        "aria-haspopup": "menu",
        "aria-expanded": open
      })
    : trigger;

  return (
    <div ref={rootRef} className="relative inline-block">
      {triggerWithProps}
      {open ? (
        <div
          role="menu"
          className={cn(
            "absolute z-40 mt-2 min-w-[13rem] animate-scale-in rounded-3xl border border-border bg-surface-strong p-1.5 shadow-raised",
            align === "end" ? "right-0" : "left-0"
          )}
        >
          {children}
        </div>
      ) : null}
    </div>
  );
}

type DropdownItemProps = ButtonHTMLAttributes<HTMLButtonElement> & { href?: string };

export function DropdownItem({ children, className, href, ...props }: DropdownItemProps) {
  const classes = cn(
    "flex w-full items-center gap-2.5 rounded-2xl px-3 py-2.5 text-left text-sm text-ink transition hover:bg-surface",
    className
  );

  if (href) {
    return (
      <Link href={href} role="menuitem" className={classes}>
        {children}
      </Link>
    );
  }

  return (
    <button type="button" role="menuitem" className={classes} {...props}>
      {children}
    </button>
  );
}

export function DropdownSeparator() {
  return <div role="separator" className="my-1.5 h-px bg-border" />;
}
