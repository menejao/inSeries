"use client";

import { useId, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Avatar } from "@/components/ui/avatar";
import { useToast } from "@/components/ui/toast";
import { getInitials } from "@/lib/utils";

type ProfileSettingsData = {
  name: string;
  username: string;
  bio: string | null;
  avatarUrl: string | null;
  isProfilePrivate: boolean;
  showWatchedSeries: boolean;
  showWatchingSeries: boolean;
  showLists: boolean;
  showReviews: boolean;
  showActivity: boolean;
};

const privacyToggles: Array<{ key: keyof ProfileSettingsData; label: string; description: string }> = [
  { key: "isProfilePrivate", label: "Perfil privado", description: "Oculta tudo abaixo de quem nao e voce." },
  { key: "showWatchingSeries", label: "Mostrar series assistindo", description: "Visivel no seu perfil publico." },
  { key: "showWatchedSeries", label: "Mostrar series concluidas", description: "Visivel no seu perfil publico." },
  { key: "showLists", label: "Mostrar listas publicas", description: "Visivel no seu perfil publico." },
  { key: "showReviews", label: "Mostrar reviews publicas", description: "Visivel no seu perfil publico." },
  { key: "showActivity", label: "Mostrar atividade", description: "Visivel no seu perfil publico." }
];

export function ProfileSettingsForm({ initial }: { initial: ProfileSettingsData }) {
  const router = useRouter();
  const { toast } = useToast();
  const nameId = useId();
  const usernameId = useId();
  const bioId = useId();
  const avatarId = useId();
  const [form, setForm] = useState(initial);
  const [isPending, startTransition] = useTransition();

  function toggle(key: keyof ProfileSettingsData) {
    setForm((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  return (
    <form
      className="space-y-6"
      onSubmit={(event) => {
        event.preventDefault();

        startTransition(async () => {
          const response = await fetch("/api/profile", {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              name: form.name,
              username: form.username,
              bio: form.bio ?? "",
              avatarUrl: form.avatarUrl ?? "",
              isProfilePrivate: form.isProfilePrivate,
              showWatchedSeries: form.showWatchedSeries,
              showWatchingSeries: form.showWatchingSeries,
              showLists: form.showLists,
              showReviews: form.showReviews,
              showActivity: form.showActivity
            })
          });

          const result = (await response.json().catch(() => ({}))) as { error?: string };

          if (!response.ok) {
            toast({ title: "Erro ao salvar perfil", description: result.error, variant: "error" });
            return;
          }

          toast({ title: "Perfil atualizado", variant: "success" });
          router.refresh();
        });
      }}
    >
      <div className="flex items-center gap-4">
        <Avatar label={getInitials(form.name || "?")} name={form.name} src={form.avatarUrl} size="lg" />
        <div className="flex-1 space-y-1.5">
          <label htmlFor={avatarId} className="text-sm font-medium text-ink">
            URL do avatar
          </label>
          <Input
            id={avatarId}
            value={form.avatarUrl ?? ""}
            onChange={(event) => setForm((prev) => ({ ...prev, avatarUrl: event.target.value }))}
            placeholder="https://..."
            type="url"
          />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <label htmlFor={nameId} className="text-sm font-medium text-ink">
            Nome
          </label>
          <Input
            id={nameId}
            value={form.name}
            onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
            minLength={2}
            maxLength={60}
            required
          />
        </div>
        <div className="space-y-1.5">
          <label htmlFor={usernameId} className="text-sm font-medium text-ink">
            Username
          </label>
          <Input
            id={usernameId}
            value={form.username}
            onChange={(event) => setForm((prev) => ({ ...prev, username: event.target.value.toLowerCase() }))}
            minLength={3}
            maxLength={24}
            pattern="^[a-z0-9](?:[a-z0-9._]{1,22}[a-z0-9])?$"
            title="Apenas letras minusculas, numeros, ponto e underline"
            required
          />
        </div>
      </div>
      <div className="space-y-1.5">
        <label htmlFor={bioId} className="text-sm font-medium text-ink">
          Bio
        </label>
        <Textarea
          id={bioId}
          value={form.bio ?? ""}
          onChange={(event) => setForm((prev) => ({ ...prev, bio: event.target.value }))}
          maxLength={280}
          placeholder="Conte algo sobre voce"
        />
      </div>

      <div className="space-y-1 border-t border-border pt-5">
        <p className="text-sm font-semibold text-ink">Privacidade</p>
        <div className="divide-y divide-border">
          {privacyToggles.map((item) => (
            <div key={item.key} className="py-3">
              <Switch
                label={item.label}
                description={item.description}
                checked={Boolean(form[item.key])}
                onChange={() => toggle(item.key)}
              />
            </div>
          ))}
        </div>
      </div>

      <Button type="submit" disabled={isPending} loading={isPending} className="w-full sm:w-auto">
        Salvar alteracoes
      </Button>
    </form>
  );
}
