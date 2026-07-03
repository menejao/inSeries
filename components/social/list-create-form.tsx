"use client";

import { useId, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/toast";

export function ListCreateForm() {
  const router = useRouter();
  const { toast } = useToast();
  const titleId = useId();
  const descriptionId = useId();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [visibility, setVisibility] = useState<"PUBLIC" | "PRIVATE">("PUBLIC");
  const [isPending, startTransition] = useTransition();

  return (
    <Card>
      <h2 className="text-lg font-semibold text-ink">Criar lista</h2>
      <form
        className="mt-4 space-y-3"
        onSubmit={(event) => {
          event.preventDefault();

          startTransition(async () => {
            const response = await fetch("/api/lists", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ title, description, visibility })
            });

            const result = (await response.json().catch(() => ({}))) as { error?: string };

            if (!response.ok) {
              toast({ title: "Erro ao criar lista", description: result.error, variant: "error" });
              return;
            }

            setTitle("");
            setDescription("");
            setVisibility("PUBLIC");
            toast({ title: "Lista criada", variant: "success" });
            router.refresh();
          });
        }}
      >
        <div className="space-y-1.5">
          <label htmlFor={titleId} className="text-sm font-medium text-ink">
            Titulo
          </label>
          <Input
            id={titleId}
            placeholder="Ex: Series para maratonar"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            minLength={2}
            maxLength={80}
            required
          />
        </div>
        <div className="space-y-1.5">
          <label htmlFor={descriptionId} className="text-sm font-medium text-ink">
            Descricao <span className="font-normal text-subtle">(opcional)</span>
          </label>
          <Textarea
            id={descriptionId}
            placeholder="Do que se trata essa lista?"
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            maxLength={280}
          />
        </div>
        <Select value={visibility} onChange={(event) => setVisibility(event.target.value as "PUBLIC" | "PRIVATE")} aria-label="Visibilidade da lista">
          <option value="PUBLIC">Publica</option>
          <option value="PRIVATE">Privada</option>
        </Select>
        <Button type="submit" disabled={isPending} loading={isPending} className="w-full sm:w-auto">
          Criar lista
        </Button>
      </form>
    </Card>
  );
}
