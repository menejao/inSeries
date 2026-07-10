"use client";

import { useId, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { StarIcon } from "@/components/ui/icons";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";

function StarRating({ value, onChange }: { value: number; onChange: (value: number) => void }) {
  return (
    <div role="radiogroup" aria-label="Nota" className="flex gap-1">
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          role="radio"
          aria-checked={value === star}
          aria-label={`${star} ${star === 1 ? "estrela" : "estrelas"}`}
          onClick={() => onChange(star)}
          className="rounded-full p-0.5 transition active:scale-90"
        >
          <StarIcon className={cn("h-7 w-7 transition", star <= value ? "fill-current text-warning-text" : "text-border-strong")} />
        </button>
      ))}
    </div>
  );
}

export function ReviewForm({
  seriesId,
  authenticated,
  initialReview
}: {
  seriesId: string;
  authenticated: boolean;
  initialReview: { rating: number; body: string; visibility: "PUBLIC" | "PRIVATE" | "FOLLOWERS"; containsSpoiler: boolean } | null;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const bodyId = useId();
  const [rating, setRating] = useState(initialReview?.rating ?? 5);
  const [body, setBody] = useState(initialReview?.body ?? "");
  const [containsSpoiler, setContainsSpoiler] = useState(initialReview?.containsSpoiler ?? false);
  const [visibility, setVisibility] = useState<"PUBLIC" | "PRIVATE">(
    initialReview?.visibility === "PRIVATE" ? "PRIVATE" : "PUBLIC"
  );
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [isPending, startTransition] = useTransition();

  if (!authenticated) {
    return (
      <Card>
        <p className="text-sm text-muted">Entre para escrever uma review.</p>
      </Card>
    );
  }

  return (
    <Card id="review-form" className="space-y-3">
      <h2 className="text-lg font-semibold text-ink">{initialReview ? "Sua review" : "Escrever review"}</h2>
      <form
        className="space-y-3"
        onSubmit={(event) => {
          event.preventDefault();

          startTransition(async () => {
            const response = await fetch(`/api/series/${seriesId}/reviews`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ rating, body, visibility, containsSpoiler })
            });

            const result = (await response.json().catch(() => ({}))) as { error?: string };

            if (!response.ok) {
              toast({ title: "Erro ao salvar review", description: result.error, variant: "error" });
              return;
            }

            toast({ title: "Review salva", variant: "success" });
            router.refresh();
          });
        }}
      >
        <div className="space-y-1.5">
          <p className="text-sm font-medium text-ink">Nota</p>
          <StarRating value={rating} onChange={setRating} />
        </div>
        <div className="space-y-1.5">
          <label htmlFor={bodyId} className="text-sm font-medium text-ink">
            Sua avaliacao
          </label>
          <Textarea
            id={bodyId}
            placeholder="O que achou da serie?"
            value={body}
            onChange={(event) => setBody(event.target.value)}
            minLength={1}
            maxLength={2000}
            required
          />
        </div>
        <Checkbox
          label="Contem spoiler"
          description="Sua review sera exibida com um aviso e ocultada ate quem ler decidir revelar."
          checked={containsSpoiler}
          onChange={(event) => setContainsSpoiler(event.target.checked)}
        />
        <Select value={visibility} onChange={(event) => setVisibility(event.target.value as "PUBLIC" | "PRIVATE")} aria-label="Visibilidade da review">
          <option value="PUBLIC">Publica</option>
          <option value="PRIVATE">Somente eu</option>
        </Select>
        <div className="flex flex-wrap gap-2">
          <Button type="submit" disabled={isPending} loading={isPending}>
            {initialReview ? "Atualizar review" : "Publicar review"}
          </Button>
          {initialReview ? (
            <Button type="button" variant="secondary" disabled={isPending} onClick={() => setConfirmingDelete(true)}>
              Apagar review
            </Button>
          ) : null}
        </div>
      </form>
      <ConfirmDialog
        open={confirmingDelete}
        onClose={() => setConfirmingDelete(false)}
        onConfirm={() => {
          startTransition(async () => {
            const response = await fetch(`/api/series/${seriesId}/reviews`, { method: "DELETE" });
            if (!response.ok) {
              toast({ title: "Erro ao apagar review", variant: "error" });
              setConfirmingDelete(false);
              return;
            }
            setBody("");
            setRating(5);
            setContainsSpoiler(false);
            setConfirmingDelete(false);
            toast({ title: "Review apagada", variant: "success" });
            router.refresh();
          });
        }}
        title="Apagar review?"
        description="Essa acao nao pode ser desfeita."
        confirmLabel="Apagar"
        confirmVariant="danger"
        loading={isPending}
      />
    </Card>
  );
}
