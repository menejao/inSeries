"use client";

import { useState, useTransition } from "react";
import { MoreVerticalIcon, CheckIcon, HeartIcon } from "@/components/ui/icons";
import { Dropdown, DropdownItem, DropdownSeparator } from "@/components/ui/dropdown";
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

export function SeriesCardActions({
  seriesId,
  initialState,
  initialFavorite
}: {
  seriesId: string;
  initialState?: WatchState;
  initialFavorite?: boolean;
}) {
  const [state, setState] = useState(initialState);
  const [isFavorite, setIsFavorite] = useState(initialFavorite ?? false);
  const [isPending, startTransition] = useTransition();

  function handleSelect(newState: WatchState) {
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

  function handleFavorite() {
    startTransition(async () => {
      await fetch(`/api/series/${seriesId}/favorite`, { method: "POST" });
      setIsFavorite((prev) => !prev);
    });
  }

  function handleRemove() {
    startTransition(async () => {
      await fetch(`/api/series/${seriesId}/status`, { method: "DELETE" });
      setState(undefined);
      setIsFavorite(false);
    });
  }

  return (
    // O card inteiro e um <Link>; este wrapper para o clique de propagar pra navegacao
    // (stopPropagation aqui roda DEPOIS do onClick do botao/itens, na fase de bubble).
    <div
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
      }}
    >
      <Dropdown
        trigger={
          <button
            aria-label="Ações rápidas"
            className={cn(
              "flex h-7 w-7 items-center justify-center rounded-full bg-canvas/80 shadow backdrop-blur-sm transition",
              "hover:bg-canvas/95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
              isPending && "opacity-60"
            )}
          >
            <MoreVerticalIcon className="h-4 w-4 text-ink" />
          </button>
        }
      >
        {WATCH_STATE_ORDER.map((ws) => (
          <DropdownItem
            key={ws}
            onClick={() => handleSelect(ws)}
            className={state === ws ? WATCH_STATE_COLORS[ws] : undefined}
          >
            {state === ws ? <CheckIcon className="h-3.5 w-3.5 shrink-0" /> : <span className="h-3.5 w-3.5 shrink-0" />}
            {WATCH_STATE_LABELS[ws]}
          </DropdownItem>
        ))}
        <DropdownSeparator />
        <DropdownItem onClick={handleFavorite} className={isFavorite ? "text-error-text" : undefined}>
          <HeartIcon className={cn("h-3.5 w-3.5 shrink-0", isFavorite && "fill-current")} />
          {isFavorite ? "Remover dos favoritos" : "Favoritar"}
        </DropdownItem>
        {state ? (
          <DropdownItem onClick={handleRemove} className="text-muted">
            <span className="h-3.5 w-3.5 shrink-0" />
            Remover da lista
          </DropdownItem>
        ) : null}
      </Dropdown>
    </div>
  );
}
