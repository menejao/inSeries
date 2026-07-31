"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";

/** INSERIES-SOCIAL-ADMIN-PANEL-03 — reagendamento de uma publicacao ainda nao publicada. */
export function PublicationRescheduleButton({ publicationId, scheduledFor }: { publicationId: string; scheduledFor: string }) {
  const router = useRouter();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [value, setValue] = useState(scheduledFor);

  async function handleConfirm() {
    setLoading(true);

    try {
      const response = await fetch(`/api/admin/social/publications/${publicationId}/reschedule`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scheduledFor: new Date(value).toISOString() })
      });
      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        toast({ title: "Nao foi possivel reagendar", description: data.message ?? data.error, variant: "error" });
      } else {
        toast({ title: "Publicacao reagendada", variant: "success" });
        setOpen(false);
        router.refresh();
      }
    } catch {
      toast({ title: "Falha de rede", variant: "error" });
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <Button variant="ghost" size="xs" onClick={() => setOpen(true)}>
        Reagendar
      </Button>
      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title="Reagendar publicacao"
        description="Move o horario previsto. Nenhuma publicacao real acontece hoje."
        footer={
          <>
            <Button type="button" variant="ghost" onClick={() => setOpen(false)} disabled={loading}>
              Cancelar
            </Button>
            <Button type="button" onClick={handleConfirm} loading={loading} disabled={!value}>
              Reagendar
            </Button>
          </>
        }
      >
        <label className="block text-sm font-medium text-ink" htmlFor={`reschedule-${publicationId}`}>
          Nova data e hora
        </label>
        <Input
          id={`reschedule-${publicationId}`}
          type="datetime-local"
          className="mt-2"
          value={value}
          onChange={(event) => setValue(event.target.value)}
        />
      </Dialog>
    </>
  );
}
