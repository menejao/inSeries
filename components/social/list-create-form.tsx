"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

export function ListCreateForm() {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [visibility, setVisibility] = useState<"PUBLIC" | "PRIVATE">("PUBLIC");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  return (
    <Card>
      <h2 className="text-lg font-semibold text-ink">Criar lista</h2>
      <form
        className="mt-4 space-y-3"
        onSubmit={(event) => {
          event.preventDefault();
          setError(null);

          startTransition(async () => {
            const response = await fetch("/api/lists", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ title, description, visibility })
            });

            const result = (await response.json().catch(() => ({}))) as { error?: string };

            if (!response.ok) {
              setError(result.error ?? "request_failed");
              return;
            }

            setTitle("");
            setDescription("");
            setVisibility("PUBLIC");
            router.refresh();
          });
        }}
      >
        <Input
          placeholder="Titulo da lista"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          minLength={2}
          maxLength={80}
          required
        />
        <Textarea
          placeholder="Descricao (opcional)"
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          maxLength={280}
        />
        <Select value={visibility} onChange={(event) => setVisibility(event.target.value as "PUBLIC" | "PRIVATE")}>
          <option value="PUBLIC">Publica</option>
          <option value="PRIVATE">Privada</option>
        </Select>
        <Button type="submit" disabled={isPending} className="w-full sm:w-auto">
          {isPending ? "Criando..." : "Criar lista"}
        </Button>
        {error ? <p className="text-sm text-rose-300">Erro: {error}</p> : null}
      </form>
    </Card>
  );
}
