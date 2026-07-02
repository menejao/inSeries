"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

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
  const [title, setTitle] = useState(initialTitle);
  const [description, setDescription] = useState(initialDescription);
  const [visibility, setVisibility] = useState(initialVisibility);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  return (
    <form
      className="space-y-3"
      onSubmit={(event) => {
        event.preventDefault();
        setError(null);
        setSuccess(null);

        startTransition(async () => {
          const response = await fetch(`/api/lists/${listId}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ title, description, visibility })
          });

          const result = (await response.json().catch(() => ({}))) as { error?: string };

          if (!response.ok) {
            setError(result.error ?? "request_failed");
            return;
          }

          setSuccess("Lista atualizada.");
          router.refresh();
        });
      }}
    >
      <Input value={title} onChange={(event) => setTitle(event.target.value)} minLength={2} maxLength={80} required />
      <Textarea value={description} onChange={(event) => setDescription(event.target.value)} maxLength={280} />
      <Select value={visibility} onChange={(event) => setVisibility(event.target.value as "PUBLIC" | "PRIVATE")}>
        <option value="PUBLIC">Publica</option>
        <option value="PRIVATE">Privada</option>
      </Select>
      <Button type="submit" disabled={isPending} className="w-full sm:w-auto">
        {isPending ? "Salvando..." : "Salvar lista"}
      </Button>
      {error ? <p className="text-sm text-rose-300">Erro: {error}</p> : null}
      {success ? <p className="text-sm text-emerald-300">{success}</p> : null}
    </form>
  );
}
