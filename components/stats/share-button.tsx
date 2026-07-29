"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ShareIcon } from "@/components/ui/icons";
import { useToast } from "@/components/ui/toast";

/** INSERIES-STATISTICS-ENGINE-01 — "Compartilhar Estatisticas". Web Share API (mobile-native sheet, includes the OG image) with a copy-link fallback for browsers without it. */
export function ShareButton({
  personaTitle,
  hoursWatched,
  episodesWatched
}: {
  personaTitle: string;
  hoursWatched: number;
  episodesWatched: number;
}) {
  const { toast } = useToast();
  const [pending, setPending] = useState(false);

  async function share() {
    setPending(true);
    try {
      const shareUrl = `${window.location.origin}/api/stats/share`;
      const text = `Sou ${personaTitle} no inSeries: ${hoursWatched}h e ${episodesWatched} episodios assistidos.`;

      if (navigator.share) {
        await navigator.share({ title: "Minhas estatisticas no inSeries", text, url: shareUrl });
        return;
      }

      await navigator.clipboard.writeText(`${text} ${shareUrl}`);
      toast({ title: "Link copiado", description: "Cole nas suas redes para compartilhar.", variant: "success" });
    } catch {
      // AbortError from a cancelled native share sheet is expected — no toast needed for that.
    } finally {
      setPending(false);
    }
  }

  return (
    <Button type="button" variant="primary" size="md" onClick={share} loading={pending}>
      <ShareIcon className="h-4 w-4" />
      Compartilhar estatisticas
    </Button>
  );
}
