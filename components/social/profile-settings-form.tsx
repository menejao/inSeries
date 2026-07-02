"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

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

const privacyToggles: Array<{ key: keyof ProfileSettingsData; label: string }> = [
  { key: "isProfilePrivate", label: "Perfil privado" },
  { key: "showWatchingSeries", label: "Mostrar series assistindo" },
  { key: "showWatchedSeries", label: "Mostrar series concluidas" },
  { key: "showLists", label: "Mostrar listas publicas" },
  { key: "showReviews", label: "Mostrar reviews publicas" },
  { key: "showActivity", label: "Mostrar atividade" }
];

export function ProfileSettingsForm({ initial }: { initial: ProfileSettingsData }) {
  const router = useRouter();
  const [form, setForm] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function toggle(key: keyof ProfileSettingsData) {
    setForm((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  return (
    <form
      className="space-y-5"
      onSubmit={(event) => {
        event.preventDefault();
        setError(null);
        setSuccess(null);

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
            setError(result.error ?? "request_failed");
            return;
          }

          setSuccess("Perfil atualizado.");
          router.refresh();
        });
      }}
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="space-y-1 text-sm text-slate-300">
          Nome
          <Input
            value={form.name}
            onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
            minLength={2}
            maxLength={60}
            required
          />
        </label>
        <label className="space-y-1 text-sm text-slate-300">
          Username
          <Input
            value={form.username}
            onChange={(event) => setForm((prev) => ({ ...prev, username: event.target.value.toLowerCase() }))}
            minLength={3}
            maxLength={24}
            pattern="^[a-z0-9](?:[a-z0-9._]{1,22}[a-z0-9])?$"
            title="Apenas letras minusculas, numeros, ponto e underline"
            required
          />
        </label>
      </div>
      <label className="block space-y-1 text-sm text-slate-300">
        Bio
        <Textarea
          value={form.bio ?? ""}
          onChange={(event) => setForm((prev) => ({ ...prev, bio: event.target.value }))}
          maxLength={280}
          placeholder="Conte algo sobre voce"
        />
      </label>
      <label className="block space-y-1 text-sm text-slate-300">
        URL do avatar
        <Input
          value={form.avatarUrl ?? ""}
          onChange={(event) => setForm((prev) => ({ ...prev, avatarUrl: event.target.value }))}
          placeholder="https://..."
          type="url"
        />
      </label>

      <div className="space-y-2">
        <p className="text-sm font-semibold text-ink">Privacidade</p>
        <div className="grid gap-2 sm:grid-cols-2">
          {privacyToggles.map((item) => (
            <label
              key={item.key}
              className="flex min-h-11 items-center gap-3 rounded-2xl border border-white/10 bg-slate-950/40 px-4 text-sm text-slate-200"
            >
              <input
                type="checkbox"
                className="h-4 w-4"
                checked={Boolean(form[item.key])}
                onChange={() => toggle(item.key)}
              />
              {item.label}
            </label>
          ))}
        </div>
      </div>

      <Button type="submit" disabled={isPending} className="w-full sm:w-auto">
        {isPending ? "Salvando..." : "Salvar alteracoes"}
      </Button>
      {error ? <p className="text-sm text-rose-300">Erro: {error}</p> : null}
      {success ? <p className="text-sm text-emerald-300">{success}</p> : null}
    </form>
  );
}
