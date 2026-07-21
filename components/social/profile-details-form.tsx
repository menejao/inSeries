"use client";

import { useId, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Avatar } from "@/components/ui/avatar";
import { useToast } from "@/components/ui/toast";
import { getInitials } from "@/lib/utils";

type ProfileDetails = { name: string; username: string; bio: string | null; avatarUrl: string | null };

/**
 * Fase 19 (INSERIES-PRODUCT-EXPERIENCE-REVOLUTION-01) — separado de ProfilePrivacyForm (antes
 * era um unico form gigante, name+username+bio+avatar+6 toggles de privacidade num so
 * submit). `PATCH /api/profile` ja aceita payload parcial (todo campo e `.optional()` em
 * `lib/social/validation.ts`) — cada form so envia os campos do seu proprio dominio, sem
 * precisar de endpoint novo.
 */
export function ProfileDetailsForm({ initial }: { initial: ProfileDetails }) {
  const router = useRouter();
  const { toast } = useToast();
  const nameId = useId();
  const usernameId = useId();
  const bioId = useId();
  const avatarId = useId();
  const [form, setForm] = useState(initial);
  const [isPending, startTransition] = useTransition();

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
              avatarUrl: form.avatarUrl ?? ""
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

      <Button type="submit" disabled={isPending} loading={isPending} className="w-full sm:w-auto">
        Salvar alteracoes
      </Button>
    </form>
  );
}
