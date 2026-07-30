"use client";

import { useId, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Avatar } from "@/components/ui/avatar";
import { useToast } from "@/components/ui/toast";
import { getInitials } from "@/lib/utils";

type ProfileDetails = { name: string; username: string; bio: string | null; avatarUrl: string | null };

const AVATAR_SIZE = 200; // px — canvas output

function cropToSquareDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const src = Math.min(img.width, img.height);
      const sx = (img.width - src) / 2;
      const sy = (img.height - src) / 2;
      const canvas = document.createElement("canvas");
      canvas.width = AVATAR_SIZE;
      canvas.height = AVATAR_SIZE;
      canvas.getContext("2d")!.drawImage(img, sx, sy, src, src, 0, 0, AVATAR_SIZE, AVATAR_SIZE);
      URL.revokeObjectURL(url);
      resolve(canvas.toDataURL("image/jpeg", 0.85));
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("load")); };
    img.src = url;
  });
}

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
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [form, setForm] = useState(initial);
  const [isPending, startTransition] = useTransition();

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const dataUrl = await cropToSquareDataUrl(file);
      setForm((prev) => ({ ...prev, avatarUrl: dataUrl }));
    } catch {
      toast({ title: "Erro ao processar imagem", variant: "error" });
    } finally {
      // reset so the same file can be re-selected
      e.target.value = "";
    }
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
        <div className="space-y-2">
          <p className="text-sm font-medium text-ink">Foto de perfil</p>
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="secondary" size="sm" onClick={() => fileInputRef.current?.click()}>
              Alterar foto
            </Button>
            {form.avatarUrl ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setForm((prev) => ({ ...prev, avatarUrl: null }))}
              >
                Remover
              </Button>
            ) : null}
          </div>
          <p className="text-xs text-subtle">JPG, PNG ou WebP · recortado automaticamente para quadrado</p>
          <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp,image/gif" onChange={handleFileChange} className="sr-only" />
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
            pattern="^[a-z0-9](?:[a-z0-9._-]{1,22}[a-z0-9])?$"
            title="Apenas letras minusculas, numeros, ponto, underline e hifen"
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
