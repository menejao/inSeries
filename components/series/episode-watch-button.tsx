"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { CheckCircleIcon } from "@/components/ui/icons";
import { useToast } from "@/components/ui/toast";
import { useMarkEpisodeWatched } from "@/components/series/mark-episode-watched-dialog";

export function EpisodeWatchButton({
  episodeId,
  initialWatched,
  authenticated,
  size = "md",
  onChange
}: {
  episodeId: string;
  initialWatched: boolean;
  authenticated: boolean;
  size?: "sm" | "md";
  /** INSERIES-SERIES-LIBRARY-ENGINE-01 — avisa o pai (EpisodeRow) assim que a mutation
   * confirma, sem esperar um router.refresh() ida-e-volta ao servidor. */
  onChange?: (watched: boolean, watchedAt: string | null) => void;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [watched, setWatched] = useState(initialWatched);
  const [isPending, startTransition] = useTransition();
  const { requestMark, dialog } = useMarkEpisodeWatched(episodeId, (watchedAt) => {
    setWatched(true);
    onChange?.(true, watchedAt);
  });

  if (!authenticated) {
    return (
      <Button variant="secondary" size={size} disabled>
        Entrar para marcar
      </Button>
    );
  }

  function unmark() {
    startTransition(async () => {
      const response = await fetch(`/api/episodes/${episodeId}/progress`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ episodeId, watched: false })
      });
      if (!response.ok) {
        toast({ title: "Erro ao atualizar episodio", variant: "error" });
        return;
      }
      setWatched(false);
      onChange?.(false, null);
      toast({ title: "Episodio desmarcado", variant: "success" });
      router.refresh();
    });
  }

  return (
    <>
      <Button
        variant={watched ? "primary" : "secondary"}
        size={size}
        disabled={isPending}
        loading={isPending}
        onClick={() => (watched ? unmark() : requestMark())}
      >
        {watched ? <CheckCircleIcon className="h-4 w-4" /> : null}
        {watched ? "Assistido" : "Marcar"}
      </Button>
      {dialog}
    </>
  );
}
