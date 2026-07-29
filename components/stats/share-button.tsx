"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Sheet } from "@/components/ui/sheet";
import { ShareIcon } from "@/components/ui/icons";
import { useToast } from "@/components/ui/toast";

type ShareFormat = { id: "stories" | "feed" | "square"; label: string; hint: string };

const FORMATS: ShareFormat[] = [
  { id: "stories", label: "Stories", hint: "Instagram/Facebook Stories, WhatsApp (1080x1920)" },
  { id: "feed", label: "Feed", hint: "Instagram Feed, Threads (1080x1350)" },
  { id: "square", label: "Quadrado", hint: "X, Facebook, WhatsApp (1080x1080)" }
];

/**
 * INSERIES-STATISTICS-ENGINE-01 — "gerar um card em imagem... o usuario escolhe onde vai
 * compartilhar e o formato." Opens a format picker, generates the real image for that format
 * (`/api/stats/share?format=`), then hands the actual image file to the native share sheet
 * (Web Share API Level 2, `files`) so the user picks the destination app themselves; falls
 * back to a direct download when file-sharing isn't supported.
 */
export function ShareButton() {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [pendingFormat, setPendingFormat] = useState<ShareFormat["id"] | null>(null);

  async function shareFormat(format: ShareFormat) {
    setPendingFormat(format.id);
    try {
      const response = await fetch(`/api/stats/share?format=${format.id}`);
      if (!response.ok) {
        toast({ title: "Erro ao gerar imagem", variant: "error" });
        return;
      }
      const blob = await response.blob();
      const file = new File([blob], `inseries-estatisticas-${format.id}.png`, { type: "image/png" });

      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: "Minhas estatisticas no inSeries" });
        setOpen(false);
        return;
      }

      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = file.name;
      link.click();
      URL.revokeObjectURL(url);
      toast({ title: "Imagem baixada", description: "Compartilhe nas suas redes favoritas.", variant: "success" });
      setOpen(false);
    } catch {
      // AbortError from a cancelled native share sheet is expected — no toast needed for that.
    } finally {
      setPendingFormat(null);
    }
  }

  return (
    <>
      <Button type="button" variant="primary" size="md" onClick={() => setOpen(true)}>
        <ShareIcon className="h-4 w-4" />
        Compartilhar estatisticas
      </Button>

      <Sheet open={open} onClose={() => setOpen(false)} title="Escolha o formato">
        <div className="grid gap-3">
          {FORMATS.map((format) => (
            <button
              key={format.id}
              type="button"
              onClick={() => shareFormat(format)}
              disabled={pendingFormat !== null}
              className="flex items-center justify-between gap-3 rounded-2xl border border-border bg-surface-strong/40 p-4 text-left transition hover:border-border-strong hover:bg-surface-strong disabled:opacity-60"
            >
              <div>
                <p className="text-sm font-semibold text-ink">{format.label}</p>
                <p className="text-xs text-subtle">{format.hint}</p>
              </div>
              {pendingFormat === format.id ? <span className="text-xs text-muted">Gerando...</span> : null}
            </button>
          ))}
        </div>
      </Sheet>
    </>
  );
}
