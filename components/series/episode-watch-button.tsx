"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { CheckCircleIcon } from "@/components/ui/icons";
import { useToast } from "@/components/ui/toast";

export function EpisodeWatchButton({
  episodeId,
  initialWatched,
  authenticated,
  size = "md"
}: {
  episodeId: string;
  initialWatched: boolean;
  authenticated: boolean;
  size?: "sm" | "md";
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [watched, setWatched] = useState(initialWatched);
  const [isPending, startTransition] = useTransition();

  if (!authenticated) {
    return (
      <Button variant="secondary" size={size} disabled>
        Entrar para marcar
      </Button>
    );
  }

  return (
    <Button
      variant={watched ? "primary" : "secondary"}
      size={size}
      disabled={isPending}
      loading={isPending}
      onClick={() => {
        startTransition(async () => {
          const nextWatched = !watched;
          const response = await fetch(`/api/episodes/${episodeId}/progress`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ episodeId, watched: nextWatched })
          });
          if (!response.ok) {
            toast({ title: "Erro ao atualizar episodio", variant: "error" });
            return;
          }
          setWatched(nextWatched);
          toast({ title: nextWatched ? "Episodio marcado" : "Episodio desmarcado", variant: "success" });
          router.refresh();
        });
      }}
    >
      {watched ? <CheckCircleIcon className="h-4 w-4" /> : null}
      {watched ? "Assistido" : "Marcar"}
    </Button>
  );
}
