"use client";

import { Button } from "@/components/ui/button";
import { Dropdown, DropdownItem } from "@/components/ui/dropdown";
import { MoreHorizontalIcon, ShareIcon } from "@/components/ui/icons";
import { useToast } from "@/components/ui/toast";

/**
 * Fase 13 (INSERIES-CATALOG-SERIES-EXPERIENCE-V2) — "Mais acoes (...)" reune o que nao e
 * Acompanhar/Lista/Avaliar. Hoje so tem "Compartilhar" (mesma logica que estava em
 * `ShareButton`, agora inline aqui); o menu ja existe pronto pra crescer sem inflar a linha de
 * botoes principal do Hero.
 */
export function SeriesMoreActions({ title }: { title: string }) {
  const { toast } = useToast();

  async function handleShare() {
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
  }

  return (
    <Dropdown
      trigger={
        <Button variant="secondary" size="md" aria-label="Mais acoes">
          <MoreHorizontalIcon className="h-4 w-4" />
        </Button>
      }
    >
      <DropdownItem onClick={handleShare}>
        <ShareIcon className="h-4 w-4" />
        Compartilhar
      </DropdownItem>
    </Dropdown>
  );
}
