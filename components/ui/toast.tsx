"use client";

import { createPortal } from "react-dom";
import { createContext, useCallback, useContext, useEffect, useState, type PropsWithChildren } from "react";
import { cn } from "@/lib/utils";
import { AlertCircleIcon, CheckCircleIcon, InfoIcon, XIcon } from "@/components/ui/icons";
import { IconButton } from "@/components/ui/button";

type ToastVariant = "success" | "error" | "info";
type ToastInput = { title: string; description?: string; variant?: ToastVariant };
type ToastItem = ToastInput & { id: string; variant: ToastVariant };

const ToastContext = createContext<{ toast: (input: ToastInput) => void } | null>(null);

const variantClasses: Record<ToastVariant, string> = {
  success: "border-success/30 bg-surface-strong text-success-text",
  error: "border-danger/30 bg-surface-strong text-danger-text",
  info: "border-secondary/30 bg-surface-strong text-secondary-text"
};

const variantIcons: Record<ToastVariant, typeof InfoIcon> = {
  success: CheckCircleIcon,
  error: AlertCircleIcon,
  info: InfoIcon
};

export function ToastProvider({ children }: PropsWithChildren) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  const dismiss = useCallback((id: string) => {
    setItems((prev) => prev.filter((item) => item.id !== id));
  }, []);

  const toast = useCallback(
    ({ variant = "info", ...input }: ToastInput) => {
      const id = typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : String(Date.now());
      setItems((prev) => [...prev, { id, variant, ...input }]);
      setTimeout(() => dismiss(id), 4500);
    },
    [dismiss]
  );

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      {mounted
        ? createPortal(
            <div className="pointer-events-none fixed inset-x-0 bottom-24 z-[60] flex flex-col items-center gap-2 px-4 sm:bottom-6 sm:items-end sm:px-6" aria-live="polite">
              {items.map((item) => {
                const Icon = variantIcons[item.variant];
                return (
                  <div
                    key={item.id}
                    role="status"
                    className={cn(
                      "pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-3xl border p-4 shadow-raised animate-fade-in-up",
                      variantClasses[item.variant]
                    )}
                  >
                    <Icon className="mt-0.5 h-5 w-5 shrink-0" />
                    <div className="flex-1 text-sm">
                      <p className="font-semibold text-ink">{item.title}</p>
                      {item.description ? <p className="mt-0.5 text-muted">{item.description}</p> : null}
                    </div>
                    <IconButton label="Fechar notificacao" size="sm" onClick={() => dismiss(item.id)} className="-m-1.5">
                      <XIcon className="h-3.5 w-3.5" />
                    </IconButton>
                  </div>
                );
              })}
            </div>,
            document.body
          )
        : null}
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within ToastProvider");
  return ctx;
}
