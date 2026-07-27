"use client";

import { useState } from "react";
import { Sheet } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { SettingsIcon } from "@/components/ui/icons";
import { cn } from "@/lib/utils";

export type PersonalCalendarStateFilter = "ALL" | "WATCHING" | "WANT_TO_WATCH";
export type PersonalCalendarSectionFilter = "ALL" | "hoje" | "esta-semana" | "atrasados";

const STATE_OPTIONS: Array<{ value: PersonalCalendarStateFilter; label: string }> = [
  { value: "ALL", label: "Todas" },
  { value: "WATCHING", label: "Assistindo" },
  { value: "WANT_TO_WATCH", label: "Quero assistir" }
];

const SECTION_OPTIONS: Array<{ value: PersonalCalendarSectionFilter; label: string }> = [
  { value: "ALL", label: "Todos" },
  { value: "hoje", label: "Hoje" },
  { value: "esta-semana", label: "Esta semana" },
  { value: "atrasados", label: "Atrasados" }
];

function ChipGroup<T extends string>({
  label,
  options,
  value,
  onChange
}: {
  label: string;
  options: Array<{ value: T; label: string }>;
  value: T;
  onChange: (value: T) => void;
}) {
  return (
    <div className="space-y-1.5">
      <p className="text-xs font-semibold uppercase tracking-[0.08em] text-subtle">{label}</p>
      <div className="flex flex-wrap gap-2">
        {options.map((option) => (
          <button
            key={option.value}
            type="button"
            onClick={() => onChange(option.value)}
            className={cn(
              "min-h-9 rounded-full border px-3.5 text-sm font-medium transition",
              value === option.value
                ? "border-primary bg-primary/10 text-primary-text"
                : "border-border bg-surface text-muted hover:border-border-strong hover:text-ink"
            )}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  );
}

/**
 * Fase 13 (INSERIES-CALENDAR-EXPERIENCE-01) — filtros de Estado (Assistindo/Quero assistir) e
 * Periodo (Hoje/Esta semana/Atrasados), aplicacao automatica (sem botao "Aplicar"). "Meu
 * calendario"/"Todas as series" ja existem como o Tabs de nivel de pagina (troca de rota
 * pessoal/global) — nao duplicados aqui como chip, pra nao ter 2 controles fazendo a mesma
 * navegacao. Sheet no mobile (abaixo de sm), barra compacta inline no desktop.
 */
export function PersonalCalendarFilters({
  stateFilter,
  sectionFilter,
  onStateChange,
  onSectionChange
}: {
  stateFilter: PersonalCalendarStateFilter;
  sectionFilter: PersonalCalendarSectionFilter;
  onStateChange: (value: PersonalCalendarStateFilter) => void;
  onSectionChange: (value: PersonalCalendarSectionFilter) => void;
}) {
  const [open, setOpen] = useState(false);
  const activeCount = (stateFilter !== "ALL" ? 1 : 0) + (sectionFilter !== "ALL" ? 1 : 0);

  return (
    <>
      <div className="hidden items-start gap-6 rounded-2xl border border-border bg-surface/70 p-4 sm:flex">
        <ChipGroup label="Estado" options={STATE_OPTIONS} value={stateFilter} onChange={onStateChange} />
        <ChipGroup label="Periodo" options={SECTION_OPTIONS} value={sectionFilter} onChange={onSectionChange} />
      </div>

      <div className="sm:hidden">
        <Button type="button" variant="secondary" size="md" onClick={() => setOpen(true)}>
          <SettingsIcon className="h-4 w-4" />
          Filtros
          {activeCount ? <span className="ml-1 rounded-full bg-primary/15 px-1.5 text-xs text-primary-text">{activeCount}</span> : null}
        </Button>
        <Sheet open={open} onClose={() => setOpen(false)} title="Filtros do calendario">
          <div className="space-y-5">
            <ChipGroup label="Estado" options={STATE_OPTIONS} value={stateFilter} onChange={onStateChange} />
            <ChipGroup label="Periodo" options={SECTION_OPTIONS} value={sectionFilter} onChange={onSectionChange} />
          </div>
          <div className="mt-5 flex justify-end border-t border-border pt-4">
            <Button type="button" variant="primary" size="sm" onClick={() => setOpen(false)}>
              Pronto
            </Button>
          </div>
        </Sheet>
      </div>
    </>
  );
}
