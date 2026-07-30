"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { ShareIcon } from "@/components/ui/icons";
import { useToast } from "@/components/ui/toast";

async function fetchImageFile(slug: string, name: string): Promise<File> {
  const response = await fetch(`/api/achievements/${slug}/share`);
  if (!response.ok) throw new Error("share_image_failed");
  const blob = await response.blob();
  return new File([blob], `inseries-conquista-${name}.png`, { type: "image/png" });
}

function downloadFile(file: File) {
  const url = URL.createObjectURL(file);
  const link = document.createElement("a");
  link.href = url;
  link.download = file.name;
  link.click();
  URL.revokeObjectURL(url);
}

/** INSERIES-ACHIEVEMENTS-REDESIGN-01 — "ao desbloquear uma conquista, permitir compartilhar": baixa (sempre disponivel) ou abre o share sheet nativo (quando o navegador suporta arquivos), mesmo padrao de components/stats/share-button.tsx. */
export function AchievementShareButton({ slug, name }: { slug: string; name: string }) {
  const { toast } = useToast();
  const [pending, setPending] = useState(false);
  const [canShareFiles, setCanShareFiles] = useState(false);

  useEffect(() => {
    setCanShareFiles(Boolean(navigator.canShare?.({ files: [new File([], "test.png", { type: "image/png" })] })));
  }, []);

  async function handleClick() {
    setPending(true);
    try {
      const file = await fetchImageFile(slug, name);
      if (canShareFiles) {
        try {
          await navigator.share({ files: [file], title: `Desbloqueei "${name}" no inSeries!` });
          return;
        } catch {
          // AbortError from a cancelled native share sheet — fall through to download.
        }
      }
      downloadFile(file);
      toast({ title: "Imagem baixada", description: "Compartilhe nas suas redes favoritas.", variant: "success" });
    } catch {
      toast({ title: "Erro ao gerar imagem", variant: "error" });
    } finally {
      setPending(false);
    }
  }

  return (
    <Button type="button" variant="ghost" size="sm" loading={pending} onClick={handleClick} aria-label={`Compartilhar conquista ${name}`}>
      <ShareIcon className="h-3.5 w-3.5" />
      Compartilhar
    </Button>
  );
}
