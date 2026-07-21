"use client";

import { SearchIcon } from "@/components/ui/icons";
import { OPEN_COMMAND_PALETTE_EVENT } from "@/components/search/command-palette";

/** Fase 4 — visible entry point for the Command Palette; Ctrl/Cmd+K works from anywhere regardless. */
export function CommandPaletteTrigger() {
  return (
    <button
      type="button"
      onClick={() => window.dispatchEvent(new Event(OPEN_COMMAND_PALETTE_EVENT))}
      aria-label="Buscar (Ctrl+K)"
      className="flex min-h-9 items-center gap-2 rounded-full border border-border bg-surface px-3 py-1.5 text-sm text-subtle transition hover:border-border-strong hover:text-muted sm:min-w-48"
    >
      <SearchIcon className="h-4 w-4 shrink-0" aria-hidden />
      <span className="hidden sm:inline">Buscar...</span>
      <kbd className="ml-auto hidden shrink-0 rounded-md border border-border bg-surface-strong px-1.5 py-0.5 text-[10px] sm:inline">Ctrl K</kbd>
    </button>
  );
}
