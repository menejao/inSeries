"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { MoreVerticalIcon, CheckIcon } from "@/components/ui/icons";
import { cn } from "@/lib/utils";
import type { WatchState } from "@/lib/types";
import { WATCH_STATE_LABELS, WATCH_STATE_ORDER } from "@/lib/progress/labels";

const WATCH_STATE_COLORS: Record<WatchState, string> = {
  WANT_TO_WATCH: "text-info-text",
  WATCHING: "text-success-text",
  PAUSED: "text-warning-text",
  DROPPED: "text-error-text",
  COMPLETED: "text-primary-text"
};

export function SeriesCardActions({ seriesId, initialState }: { seriesId: string; initialState?: WatchState }) {
  const [open, setOpen] = useState(false);
  const [state, setState] = useState(initialState);
  const [isPending, startTransition] = useTransition();
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handleOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleOutside);
    return () => document.removeEventListener("mousedown", handleOutside);
  }, [open]);

  function handleToggle(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    setOpen((v) => !v);
  }

  function handleSelect(e: React.MouseEvent, newState: WatchState) {
    e.preventDefault();
    e.stopPropagation();
    setOpen(false);
    if (newState === state) return;
    startTransition(async () => {
      await fetch(`/api/series/${seriesId}/status`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ seriesId, state: newState })
      });
      setState(newState);
    });
  }

  function handleRemove(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    setOpen(false);
    startTransition(async () => {
      await fetch(`/api/series/${seriesId}/status`, { method: "DELETE" });
      setState(undefined);
    });
  }

  return (
    <div ref={menuRef} className="relative">
      <button
        onClick={handleToggle}
        aria-label="Ações rápidas"
        aria-expanded={open}
        className={cn(
          "flex h-7 w-7 items-center justify-center rounded-full bg-canvas/80 shadow backdrop-blur-sm transition",
          "hover:bg-canvas/95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
          isPending && "opacity-60"
        )}
      >
        <MoreVerticalIcon className="h-4 w-4 text-ink" />
      </button>

      {open && (
        <div className="absolute right-0 top-8 z-50 min-w-[160px] overflow-hidden rounded-xl border border-border bg-surface shadow-raised">
          {WATCH_STATE_ORDER.map((ws) => (
            <button
              key={ws}
              onClick={(e) => handleSelect(e, ws)}
              className={cn(
                "flex w-full items-center gap-2 px-3 py-2 text-left text-sm transition hover:bg-surface-strong",
                state === ws ? WATCH_STATE_COLORS[ws] : "text-ink"
              )}
            >
              {state === ws ? <CheckIcon className="h-3.5 w-3.5 shrink-0" /> : <span className="h-3.5 w-3.5 shrink-0" />}
              {WATCH_STATE_LABELS[ws]}
            </button>
          ))}
          {state && (
            <>
              <div className="mx-2 my-1 border-t border-border" />
              <button
                onClick={handleRemove}
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-muted transition hover:bg-surface-strong hover:text-ink"
              >
                <span className="h-3.5 w-3.5 shrink-0" />
                Remover da lista
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
