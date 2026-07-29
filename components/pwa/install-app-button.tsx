"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Sheet } from "@/components/ui/sheet";
import { useToast } from "@/components/ui/toast";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

function isStandalone() {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

function isIos() {
  return /iphone|ipad|ipod/i.test(navigator.userAgent);
}

export function InstallAppButton() {
  const { toast } = useToast();
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(false);
  const [iosInstructionsOpen, setIosInstructionsOpen] = useState(false);
  const [ios, setIos] = useState(false);

  useEffect(() => {
    setInstalled(isStandalone());
    setIos(isIos());

    function handleBeforeInstallPrompt(event: Event) {
      event.preventDefault();
      setDeferredPrompt(event as BeforeInstallPromptEvent);
    }
    function handleAppInstalled() {
      setInstalled(true);
      setDeferredPrompt(null);
    }

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    window.addEventListener("appinstalled", handleAppInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
      window.removeEventListener("appinstalled", handleAppInstalled);
    };
  }, []);

  if (installed) {
    return <p className="text-sm text-muted">App ja instalado neste dispositivo.</p>;
  }

  async function handleClick() {
    if (deferredPrompt) {
      await deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      setDeferredPrompt(null);
      if (outcome === "accepted") {
        toast({ title: "Atalho criado", description: "inSeries adicionado a tela inicial.", variant: "success" });
      }
      return;
    }
    if (ios) {
      setIosInstructionsOpen(true);
      return;
    }
    toast({
      title: "Instalacao nao disponivel",
      description: "Seu navegador nao suporta instalar o app diretamente. Procure a opcao no menu do navegador.",
      variant: "error"
    });
  }

  return (
    <>
      <Button type="button" variant="secondary" size="md" onClick={handleClick}>
        Adicionar a tela inicial
      </Button>

      <Sheet open={iosInstructionsOpen} onClose={() => setIosInstructionsOpen(false)} title="Adicionar a tela inicial">
        <ol className="list-decimal space-y-2 pl-5 text-sm text-ink">
          <li>
            Toque no icone de <strong>Compartilhar</strong> na barra do Safari.
          </li>
          <li>
            Selecione <strong>Adicionar a Tela de Inicio</strong>.
          </li>
          <li>
            Toque em <strong>Adicionar</strong> no canto superior direito.
          </li>
        </ol>
      </Sheet>
    </>
  );
}
