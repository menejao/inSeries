"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

export function EpisodeWatchButton({
  episodeId,
  initialWatched,
  authenticated
}: {
  episodeId: string;
  initialWatched: boolean;
  authenticated: boolean;
}) {
  const router = useRouter();
  const [watched, setWatched] = useState(initialWatched);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  if (!authenticated) {
    return <Button variant="secondary">Entrar para marcar</Button>;
  }

  return (
    <div className="space-y-2">
      <Button
        variant={watched ? "primary" : "secondary"}
        disabled={isPending}
        onClick={() => {
          setFeedback(null);
          startTransition(async () => {
            const nextWatched = !watched;
            const response = await fetch(`/api/episodes/${episodeId}/progress`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ episodeId, watched: nextWatched })
            });
            if (!response.ok) {
              setFeedback("Erro ao atualizar episodio.");
              return;
            }
            setWatched(nextWatched);
            setFeedback(nextWatched ? "Episodio marcado." : "Episodio desmarcado.");
            router.refresh();
          });
        }}
      >
        {isPending ? "Salvando..." : watched ? "Assistido" : "Marcar"}
      </Button>
      {feedback ? <p className="text-xs text-slate-300">{feedback}</p> : null}
    </div>
  );
}
