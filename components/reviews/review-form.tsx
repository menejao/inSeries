"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

export function ReviewForm({
  seriesId,
  authenticated,
  initialReview
}: {
  seriesId: string;
  authenticated: boolean;
  initialReview: { rating: number; body: string; visibility: "PUBLIC" | "PRIVATE" | "FOLLOWERS" } | null;
}) {
  const router = useRouter();
  const [rating, setRating] = useState(initialReview?.rating ?? 5);
  const [body, setBody] = useState(initialReview?.body ?? "");
  const [visibility, setVisibility] = useState<"PUBLIC" | "PRIVATE">(
    initialReview?.visibility === "PRIVATE" ? "PRIVATE" : "PUBLIC"
  );
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  if (!authenticated) {
    return (
      <Card>
        <p className="text-sm text-slate-300">Entre para escrever uma review.</p>
      </Card>
    );
  }

  return (
    <Card className="space-y-3">
      <h2 className="text-lg font-semibold text-ink">{initialReview ? "Sua review" : "Escrever review"}</h2>
      <form
        className="space-y-3"
        onSubmit={(event) => {
          event.preventDefault();
          setError(null);
          setSuccess(null);

          startTransition(async () => {
            const response = await fetch(`/api/series/${seriesId}/reviews`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ rating, body, visibility })
            });

            const result = (await response.json().catch(() => ({}))) as { error?: string };

            if (!response.ok) {
              setError(result.error ?? "request_failed");
              return;
            }

            setSuccess("Review salva.");
            router.refresh();
          });
        }}
      >
        <label className="block space-y-1 text-sm text-slate-300">
          Nota
          <Select value={rating} onChange={(event) => setRating(Number(event.target.value))}>
            {[1, 2, 3, 4, 5].map((value) => (
              <option key={value} value={value}>
                {value} {value === 1 ? "estrela" : "estrelas"}
              </option>
            ))}
          </Select>
        </label>
        <Textarea
          placeholder="O que achou da serie?"
          value={body}
          onChange={(event) => setBody(event.target.value)}
          minLength={1}
          maxLength={2000}
          required
        />
        <Select value={visibility} onChange={(event) => setVisibility(event.target.value as "PUBLIC" | "PRIVATE")}>
          <option value="PUBLIC">Publica</option>
          <option value="PRIVATE">Somente eu</option>
        </Select>
        <div className="flex flex-wrap gap-2">
          <Button type="submit" disabled={isPending}>
            {isPending ? "Salvando..." : initialReview ? "Atualizar review" : "Publicar review"}
          </Button>
          {initialReview ? (
            <Button
              type="button"
              variant="secondary"
              disabled={isPending}
              onClick={() => {
                setError(null);
                startTransition(async () => {
                  const response = await fetch(`/api/series/${seriesId}/reviews`, { method: "DELETE" });
                  if (!response.ok) {
                    setError("request_failed");
                    return;
                  }
                  setBody("");
                  setRating(5);
                  router.refresh();
                });
              }}
            >
              Apagar review
            </Button>
          ) : null}
        </div>
        {error ? <p className="text-sm text-rose-300">Erro: {error}</p> : null}
        {success ? <p className="text-sm text-emerald-300">{success}</p> : null}
      </form>
    </Card>
  );
}
