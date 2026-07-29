"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Sheet } from "@/components/ui/sheet";
import { DownloadIcon, ShareIcon } from "@/components/ui/icons";
import { useToast } from "@/components/ui/toast";

type ShareFormat = { id: "stories" | "feed" | "square"; label: string; hint: string };

const FORMATS: ShareFormat[] = [
  { id: "stories", label: "Stories", hint: "Instagram/Facebook Stories, WhatsApp (1080x1920)" },
  { id: "feed", label: "Feed", hint: "Instagram Feed, Threads (1080x1350)" },
  { id: "square", label: "Quadrado", hint: "X, Facebook, WhatsApp (1080x1080)" }
];

async function fetchImageFile(formatId: ShareFormat["id"]): Promise<File> {
  const response = await fetch(`/api/stats/share?format=${formatId}`);
  if (!response.ok) throw new Error("share_image_failed");
  const blob = await response.blob();
  return new File([blob], `inseries-estatisticas-${formatId}.png`, { type: "image/png" });
}

function downloadFile(file: File) {
  const url = URL.createObjectURL(file);
  const link = document.createElement("a");
  link.href = url;
  link.download = file.name;
  link.click();
  URL.revokeObjectURL(url);
}

/**
 * INSERIES-STATISTICS-ENGINE-01 — "gerar um card em imagem... o usuario escolhe onde vai
 * compartilhar e o formato... precisa ter apenas a opcao de download tambem." Each format
 * always exposes a direct download action; "Compartilhar" (native share sheet, Web Share API
 * Level 2 `files`) only shows up when the browser actually supports sharing files, instead of
 * being the only path with download as a silent fallback.
 */
export function ShareButton() {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState<string | null>(null);
  const [canShareFiles, setCanShareFiles] = useState(false);

  useEffect(() => {
    setCanShareFiles(Boolean(navigator.canShare?.({ files: [new File([], "test.png", { type: "image/png" })] })));
  }, []);

  async function handleDownload(format: ShareFormat) {
    setPending(`${format.id}-download`);
    try {
      downloadFile(await fetchImageFile(format.id));
      toast({ title: "Imagem baixada", description: "Compartilhe nas suas redes favoritas.", variant: "success" });
    } catch {
      toast({ title: "Erro ao gerar imagem", variant: "error" });
    } finally {
      setPending(null);
    }
  }

  async function handleShare(format: ShareFormat) {
    setPending(`${format.id}-share`);
    try {
      const file = await fetchImageFile(format.id);
      await navigator.share({ files: [file], title: "Minhas estatisticas no inSeries" });
      setOpen(false);
    } catch {
      // AbortError from a cancelled native share sheet is expected — no toast needed for that.
    } finally {
      setPending(null);
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
            <div key={format.id} className="flex items-center justify-between gap-3 rounded-2xl border border-border bg-surface-strong/40 p-4">
              <div>
                <p className="text-sm font-semibold text-ink">{format.label}</p>
                <p className="text-xs text-subtle">{format.hint}</p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  aria-label={`Baixar imagem no formato ${format.label}`}
                  loading={pending === `${format.id}-download`}
                  disabled={pending !== null}
                  onClick={() => handleDownload(format)}
                >
                  <DownloadIcon className="h-4 w-4" />
                </Button>
                {canShareFiles ? (
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    aria-label={`Compartilhar imagem no formato ${format.label}`}
                    loading={pending === `${format.id}-share`}
                    disabled={pending !== null}
                    onClick={() => handleShare(format)}
                  >
                    <ShareIcon className="h-4 w-4" />
                  </Button>
                ) : null}
              </div>
            </div>
          ))}
        </div>
      </Sheet>
    </>
  );
}
