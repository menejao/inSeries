"use client";

import { useTheme, type ThemeMode } from "@/components/theme/theme-provider";
import { DropdownItem } from "@/components/ui/dropdown";
import { CheckIcon, MonitorIcon, MoonIcon, SunIcon } from "@/components/ui/icons";
import { cn } from "@/lib/utils";

const OPTIONS: { mode: ThemeMode; label: string; icon: typeof SunIcon }[] = [
  { mode: "light", label: "Claro", icon: SunIcon },
  { mode: "dark", label: "Escuro", icon: MoonIcon },
  { mode: "system", label: "Seguir sistema", icon: MonitorIcon }
];

/** Fase 6/7 — the full 3-way theme choice, only available where there's an avatar dropdown to host it (authenticated users). */
export function ThemeMenuItems() {
  const { mode, setMode } = useTheme();

  return (
    <>
      {OPTIONS.map((option) => (
        <DropdownItem key={option.mode} onClick={() => setMode(option.mode)} className={cn(mode === option.mode && "text-primary-text")}>
          <option.icon className="h-4 w-4" />
          <span className="flex-1">{option.label}</span>
          {mode === option.mode ? <CheckIcon className="h-4 w-4" /> : null}
        </DropdownItem>
      ))}
    </>
  );
}
