"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/components/ui/toast";

type PrivacySettings = {
  isProfilePrivate: boolean;
  showWatchedSeries: boolean;
  showWatchingSeries: boolean;
  showLists: boolean;
  showReviews: boolean;
  showActivity: boolean;
};

const TOGGLES: Array<{ key: keyof PrivacySettings; label: string; description: string }> = [
  { key: "isProfilePrivate", label: "Perfil privado", description: "Oculta tudo abaixo de quem nao e voce." },
  { key: "showWatchingSeries", label: "Mostrar series assistindo", description: "Visivel no seu perfil publico." },
  { key: "showWatchedSeries", label: "Mostrar series concluidas", description: "Visivel no seu perfil publico." },
  { key: "showLists", label: "Mostrar listas publicas", description: "Visivel no seu perfil publico." },
  { key: "showReviews", label: "Mostrar reviews publicas", description: "Visivel no seu perfil publico." },
  { key: "showActivity", label: "Mostrar atividade", description: "Visivel no seu perfil publico." }
];

/** Fase 19 — irma de ProfileDetailsForm, mesmo PATCH /api/profile, so os 6 campos de privacidade. */
export function ProfilePrivacyForm({ initial }: { initial: PrivacySettings }) {
  const router = useRouter();
  const { toast } = useToast();
  const [form, setForm] = useState(initial);
  const [isPending, startTransition] = useTransition();

  function toggle(key: keyof PrivacySettings) {
    setForm((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  return (
    <form
      className="space-y-4"
      onSubmit={(event) => {
        event.preventDefault();

        startTransition(async () => {
          const response = await fetch("/api/profile", {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(form)
          });

          const result = (await response.json().catch(() => ({}))) as { error?: string };

          if (!response.ok) {
            toast({ title: "Erro ao salvar privacidade", description: result.error, variant: "error" });
            return;
          }

          toast({ title: "Privacidade atualizada", variant: "success" });
          router.refresh();
        });
      }}
    >
      <div className="divide-y divide-border">
        {TOGGLES.map((item) => (
          <div key={item.key} className="py-3">
            <Switch label={item.label} description={item.description} checked={Boolean(form[item.key])} onChange={() => toggle(item.key)} />
          </div>
        ))}
      </div>

      <Button type="submit" disabled={isPending} loading={isPending} className="w-full sm:w-auto">
        Salvar alteracoes
      </Button>
    </form>
  );
}
