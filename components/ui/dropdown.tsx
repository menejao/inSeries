"use client";

import Link from "next/link";
import { createPortal } from "react-dom";
import {
  cloneElement,
  isValidElement,
  useEffect,
  useLayoutEffect,
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

const MENU_MIN_WIDTH = 208; // 13rem, mesmo min-w de antes
const VIEWPORT_MARGIN = 8;

/**
 * O menu e renderizado num portal com `position: fixed` (nao mais absoluto dentro do
 * container do trigger): um Dropdown dentro de qualquer ancestral com `overflow-hidden`
 * (ex: o hero da pagina da serie) era cortado. Posicao calculada a partir do rect do
 * trigger, com clamp pra nunca sair da viewport; fecha em scroll/resize (mais simples e
 * robusto que reposicionar continuamente).
 */
export function Dropdown({ trigger, children, align = "end" }: DropdownProps) {
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState<{ top: number; left: number } | null>(null);
  const triggerRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  useLayoutEffect(() => {
    if (!open) {
      setPosition(null);
      return;
    }
    const rect = triggerRef.current?.getBoundingClientRect();
    if (!rect) return;

    const left =
      align === "end"
        ? Math.max(VIEWPORT_MARGIN, rect.right - MENU_MIN_WIDTH)
        : Math.min(rect.left, window.innerWidth - MENU_MIN_WIDTH - VIEWPORT_MARGIN);
    setPosition({ top: rect.bottom + 8, left });
  }, [open, align]);

  // Segundo passo, depois que o menu renderiza e tem altura real: se estourar a borda
  // inferior da viewport, abre pra CIMA do trigger (flip), com clamp final na margem.
  useLayoutEffect(() => {
    if (!open || !position || !menuRef.current || !triggerRef.current) return;
    const menuHeight = menuRef.current.offsetHeight;
    const triggerRect = triggerRef.current.getBoundingClientRect();
    if (position.top + menuHeight > window.innerHeight - VIEWPORT_MARGIN) {
      const flippedTop = Math.max(VIEWPORT_MARGIN, triggerRect.top - menuHeight - 8);
      if (flippedTop !== position.top) setPosition({ top: flippedTop, left: position.left });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, position?.top]);

  useEffect(() => {
    if (!open) return;

    function handlePointerDown(event: MouseEvent) {
      const target = event.target as Node;
      if (triggerRef.current?.contains(target)) return;
      if (menuRef.current?.contains(target)) return;
      setOpen(false);
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }

    function handleClose() {
      setOpen(false);
    }

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    window.addEventListener("resize", handleClose);
    window.addEventListener("scroll", handleClose, true);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("resize", handleClose);
      window.removeEventListener("scroll", handleClose, true);
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
    <div ref={triggerRef} className="relative inline-block">
      {triggerWithProps}
      {mounted && open && position
        ? createPortal(
            <div
              ref={menuRef}
              role="menu"
              style={{ top: position.top, left: position.left, minWidth: MENU_MIN_WIDTH }}
              className="fixed z-50 animate-scale-in rounded-3xl border border-border bg-surface-strong p-1.5 shadow-raised"
            >
              {children}
            </div>,
            document.body
          )
        : null}
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
