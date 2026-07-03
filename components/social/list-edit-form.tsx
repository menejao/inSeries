"use client";

import { useId, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/toast";

export function ListEditForm({
  listId,
  initialTitle,
  initialDescription,
  initialVisibility
}: {
  listId: string;
  initialTitle: string;
  initialDescription: string;
  initialVisibility: "PUBLIC" | "PRIVATE";
}) {
  const router = useRouter();
  const { toast } = useToast();
  const titleId = useId();
  const descriptionId = useId();
  const [title, setTitle] = useState(initialTitle);
  const [description, setDescription] = useState(initialDescription);
  const [visibility, setVisibility] = useState(initialVisibility);
  const [isPending, startTransition] = useTransition();

  return (
    <form
      className="space-y-3"
      onSubmit={(event) => {
        event.preventDefault();

        startTransition(async () => {
          const response = await fetch(`/api/lists/${listId}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ title, description, visibility })
          });

          const result = (await response.json().catch(() => ({}))) as { error?: string };

          if (!response.ok) {
            toast({ title: "Erro ao salvar lista", description: result.error, variant: "error" });
            return;
          }

          toast({ title: "Lista atualizada", variant: "success" });
          router.refresh();
        });
      }}
    >
      <div className="space-y-1.5">
        <label htmlFor={titleId} className="text-sm font-medium text-ink">
          Titulo
        </label>
        <Input id={titleId} value={title} onChange={(event) => setTitle(event.target.value)} minLength={2} maxLength={80} required />
      </div>
      <div className="space-y-1.5">
        <label htmlFor={descriptionId} className="text-sm font-medium text-ink">
          Descricao
        </label>
        <Textarea id={descriptionId} value={description} onChange={(event) => setDescription(event.target.value)} maxLength={280} />
      </div>
      <Select value={visibility} onChange={(event) => setVisibility(event.target.value as "PUBLIC" | "PRIVATE")} aria-label="Visibilidade da lista">
        <option value="PUBLIC">Publica</option>
        <option value="PRIVATE">Privada</option>
      </Select>
      <Button type="submit" disabled={isPending} loading={isPending} className="w-full sm:w-auto">
        Salvar lista
      </Button>
    </form>
  );
}
