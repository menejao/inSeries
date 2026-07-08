"use client";

import { Button } from "@/components/ui/button";
import { ShareIcon } from "@/components/ui/icons";
import { useToast } from "@/components/ui/toast";

/**
 * Fase 2 (INSERIES-SERIES-PAGE-PREMIUM-01) — pure client-side, no business rule: Web Share
 * API when available (mobile/native share sheet), clipboard copy as fallback. Never touches
 * any server data.
 */
export function ShareButton({ title }: { title: string }) {
  const { toast } = useToast();

  return (
    <Button
      variant="secondary"
      size="md"
      onClick={async () => {
        const url = window.location.href;
        if (navigator.share) {
          try {
            await navigator.share({ title, url });
          } catch {
            // user canceled the share sheet — not an error
          }
          return;
        }
        try {
          await navigator.clipboard.writeText(url);
          toast({ title: "Link copiado", variant: "success" });
        } catch {
          toast({ title: "Nao foi possivel copiar o link", variant: "error" });
        }
      }}
    >
      <ShareIcon className="h-4 w-4" />
      Compartilhar
    </Button>
  );
}
