"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Switch } from "@/components/ui/switch";
import { Select } from "@/components/ui/select";
import { useToast } from "@/components/ui/toast";

type AutoPauseSettings = { autoPauseInactiveSeries: boolean; autoPauseInactiveDays: number | null };

/**
 * INSERIES-SERIES-STATUS-ENGINE-01 — "Pausar automaticamente series inativas" (padrao
 * ligado) + periodo (30/60/90/Nunca). "Nunca" so desliga o valor do periodo — `autoPauseInactiveSeries`
 * continua existindo separadamente porque desligar o switch (sem mexer no periodo escolhido)
 * tem que ser reversivel sem perder a preferencia de dias. Nunca oferece "Abandonada" aqui —
 * essa automacao so pausa, nunca abandona (decisao do produto, ver lib/progress/inactivity.ts).
 */
export function AutoPauseForm({ initial }: { initial: AutoPauseSettings }) {
  const router = useRouter();
  const { toast } = useToast();
  const [enabled, setEnabled] = useState(initial.autoPauseInactiveSeries);
  const [days, setDays] = useState<number | null>(initial.autoPauseInactiveDays);
  const [isPending, startTransition] = useTransition();

  function save(next: AutoPauseSettings) {
    startTransition(async () => {
      const response = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(next)
      });
      if (!response.ok) {
        toast({ title: "Erro ao salvar preferencia", variant: "error" });
        return;
      }
      toast({ title: "Preferencia salva", variant: "success" });
      router.refresh();
    });
  }

  return (
    <div className="space-y-4">
      <Switch
        label="Pausar automaticamente series inativas"
        description="Series 'Assistindo' sem nenhum episodio novo dentro do periodo abaixo mudam para 'Pausada'."
        checked={enabled}
        disabled={isPending}
        onChange={() => {
          const next = !enabled;
          setEnabled(next);
          save({ autoPauseInactiveSeries: next, autoPauseInactiveDays: days });
        }}
      />

      <div className="max-w-[220px]">
        <Select
          aria-label="Periodo de inatividade"
          value={days === null ? "never" : String(days)}
          disabled={isPending || !enabled}
          onChange={(event) => {
            const next = event.target.value === "never" ? null : Number(event.target.value);
            setDays(next);
            save({ autoPauseInactiveSeries: enabled, autoPauseInactiveDays: next });
          }}
        >
          <option value="30">30 dias</option>
          <option value="60">60 dias</option>
          <option value="90">90 dias</option>
          <option value="never">Nunca</option>
        </Select>
      </div>
    </div>
  );
}
