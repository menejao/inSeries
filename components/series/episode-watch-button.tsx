"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { CheckCircleIcon } from "@/components/ui/icons";
import { useToast } from "@/components/ui/toast";
import { useMarkEpisodeWatched } from "@/components/series/mark-episode-watched-dialog";

/**
 * INSERIES-SERIES-LIBRARY-ENGINE-01 — componente controlado (nao mais dono do proprio
 * `watched`): tinha seu proprio `useState(initialWatched)` que nunca resincronizava quando o
 * pai (EpisodeRow) recebia um `episode.watched` novo por fora (ex: marcar a serie inteira como
 * Concluida) — o badge "Assistido" do card acompanhava certinho, mas o botao continuava preso
 * em "Marcar" ate um reload. EpisodeRow agora e a unica fonte de verdade; este componente so
 * dispara a mutation e avisa via `onChange`.
 */
export function EpisodeWatchButton({
  episodeId,
  watched,
  authenticated,
  size = "md",
  onChange
}: {
  episodeId: string;
  watched: boolean;
  authenticated: boolean;
  size?: "sm" | "md";
  onChange: (watched: boolean, watchedAt: string | null) => void;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [isPending, startTransition] = useTransition();
  const { requestMark, dialog } = useMarkEpisodeWatched(episodeId, (watchedAt) => onChange(true, watchedAt));

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
      onChange(false, null);
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
