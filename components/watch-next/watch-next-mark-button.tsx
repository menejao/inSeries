"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { CheckCircleIcon } from "@/components/ui/icons";
import { useToast } from "@/components/ui/toast";

/**
 * Fase 7 — reuses the exact same mutation every other "mark watched" button
 * in the app calls (`POST /api/episodes/[id]/progress` -> toggleEpisodeProgress).
 * No parallel progress logic: `router.refresh()` re-runs the server component,
 * which re-derives the next pending episode (or drops the series entirely) from
 * the same lib/watch-next query every other consumer uses.
 */
export function WatchNextMarkButton({ episodeId }: { episodeId: string }) {
  const router = useRouter();
  const { toast } = useToast();
  const [justWatched, setJustWatched] = useState(false);
  const [isPending, startTransition] = useTransition();

  return (
    <Button
      variant="primary"
      size="lg"
      className="w-full sm:w-auto"
      disabled={isPending || justWatched}
      loading={isPending}
      onClick={() => {
        startTransition(async () => {
          const response = await fetch(`/api/episodes/${episodeId}/progress`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ episodeId, watched: true })
          });
          if (!response.ok) {
            toast({ title: "Erro ao marcar episodio", variant: "error" });
            return;
          }
          setJustWatched(true);
          toast({ title: "Episodio marcado como assistido", variant: "success" });
          router.refresh();
        });
      }}
    >
      <CheckCircleIcon className="h-5 w-5" />
      {justWatched ? "Assistido!" : "Marcar assistido"}
    </Button>
  );
}
