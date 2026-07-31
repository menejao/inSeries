"use client";

import { useState } from "react";
import { Dropdown, DropdownItem } from "@/components/ui/dropdown";
import { MoreHorizontalIcon, ThumbsUpIcon, ThumbsDownIcon, CheckIcon, EyeOffIcon } from "@/components/ui/icons";
import { useToast } from "@/components/ui/toast";

type FeedbackAction = "LIKE" | "NOT_INTERESTED" | "ALREADY_WATCHED" | "HIDDEN";

const ACTIONS: Array<{ action: FeedbackAction; label: string; icon: typeof ThumbsUpIcon; toast: string; removesCard: boolean }> = [
  { action: "LIKE", label: "Gostei", icon: ThumbsUpIcon, toast: "Vamos mostrar mais series assim.", removesCard: false },
  { action: "NOT_INTERESTED", label: "Nao me interessa", icon: ThumbsDownIcon, toast: "Anotado — menos series parecidas com essa.", removesCard: true },
  { action: "ALREADY_WATCHED", label: "Ja assisti", icon: CheckIcon, toast: "Marcado. Nao vamos mais recomendar essa.", removesCard: true },
  { action: "HIDDEN", label: "Ocultar", icon: EyeOffIcon, toast: "Serie ocultada das suas recomendacoes.", removesCard: true }
];

/**
 * INSERIES-RECOMMENDATION-ENGINE-02 — "adicionar acoes rapidas ... esse feedback deve
 * alimentar futuras recomendacoes". A small overlay menu on every recommendation card;
 * NOT_INTERESTED/ALREADY_WATCHED/HIDDEN remove the card from view immediately (optimistic —
 * the engine excludes it server-side from now on too), LIKE just confirms without removing.
 */
export function RecommendationFeedbackMenu({ seriesId, onHide }: { seriesId: string; onHide: () => void }) {
  const { toast } = useToast();
  const [pending, setPending] = useState(false);

  async function send(entry: (typeof ACTIONS)[number]) {
    if (pending) return;
    setPending(true);
    try {
      const response = await fetch("/api/recommendations/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ seriesId, action: entry.action })
      });
      if (!response.ok) {
        toast({ title: "Erro ao registrar feedback", variant: "error" });
        return;
      }
      toast({ title: entry.label, description: entry.toast, variant: "success" });
      if (entry.removesCard) onHide();
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="absolute right-2 top-2 z-10" onClick={(event) => event.preventDefault()}>
      <Dropdown
        align="end"
        trigger={
          <button
            type="button"
            aria-label="Feedback sobre esta recomendacao"
            className="flex h-7 w-7 items-center justify-center rounded-full bg-canvas/70 text-ink backdrop-blur transition hover:bg-canvas/90"
          >
            <MoreHorizontalIcon className="h-4 w-4" />
          </button>
        }
      >
        {ACTIONS.map((entry) => (
          <DropdownItem key={entry.action} onClick={() => send(entry)} disabled={pending}>
            <entry.icon className="h-4 w-4" />
            {entry.label}
          </DropdownItem>
        ))}
      </Dropdown>
    </div>
  );
}
