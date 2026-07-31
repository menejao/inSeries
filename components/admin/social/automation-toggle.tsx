"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/toast";

/**
 * INSERIES-SOCIAL-ADMIN-PANEL-03 — pause/resume, the only writable setting in the panel.
 * Posts to /api/admin/social/settings/automation, which persists via the package's settings module
 * (SystemSetting). The optional reason is stored alongside the flag and audited.
 */
export function AutomationToggle({ paused, reason }: { paused: boolean; reason: string | null }) {
  const router = useRouter();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [note, setNote] = useState("");

  const nextPaused = !paused;

  async function handleConfirm() {
    setLoading(true);

    try {
      const response = await fetch("/api/admin/social/settings/automation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ paused: nextPaused, reason: note.trim() || null })
      });
      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        toast({ title: "Nao foi possivel alterar", description: data.message ?? data.error, variant: "error" });
      } else {
        toast({ title: nextPaused ? "Automacao pausada" : "Automacao retomada", variant: "success" });
        setNote("");
        router.refresh();
      }
    } catch {
      toast({ title: "Falha de rede", variant: "error" });
    } finally {
      setLoading(false);
      setOpen(false);
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      <Badge variant={paused ? "warning" : "success"}>{paused ? "Pausada" : "Ativa"}</Badge>
      {reason ? <span className="text-xs text-muted">Motivo: {reason}</span> : null}
      <Button variant={paused ? "primary" : "secondary"} size="sm" onClick={() => setOpen(true)}>
        {paused ? "Retomar automacao" : "Pausar automacao"}
      </Button>

      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title={nextPaused ? "Pausar automacao social?" : "Retomar automacao social?"}
        description={
          nextPaused
            ? "Enquanto pausada, a geracao manual de conteudo pelo painel fica bloqueada."
            : "A geracao manual de conteudo pelo painel volta a ser permitida."
        }
        footer={
          <>
            <Button type="button" variant="ghost" onClick={() => setOpen(false)} disabled={loading}>
              Cancelar
            </Button>
            <Button type="button" onClick={handleConfirm} loading={loading}>
              {nextPaused ? "Pausar" : "Retomar"}
            </Button>
          </>
        }
      >
        <label className="block text-sm font-medium text-ink" htmlFor="automation-toggle-reason">
          Motivo (opcional)
        </label>
        <Textarea
          id="automation-toggle-reason"
          className="mt-2"
          value={note}
          onChange={(event) => setNote(event.target.value)}
          placeholder="Ex.: revisando as regras editoriais antes de retomar."
        />
      </Dialog>
    </div>
  );
}
