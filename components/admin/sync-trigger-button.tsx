"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

export function SyncTriggerButton({ type, label, confirmMessage }: { type: "popular" | "existing"; label: string; confirmMessage: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function handleClick() {
    if (!window.confirm(confirmMessage)) return;

    setLoading(true);
    setMessage(null);

    try {
      const response = await fetch(`/api/admin/sync/${type}`, { method: "POST" });
      const data = await response.json();

      if (!response.ok) {
        setMessage(data.error ?? "Falha ao iniciar sincronizacao.");
      } else if (data.summary?.errorMessage) {
        setMessage(data.summary.errorMessage);
      } else {
        setMessage(`Sincronizacao concluida: ${data.summary.status}.`);
      }

      router.refresh();
    } catch {
      setMessage("Falha de rede ao iniciar sincronizacao.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-2">
      <Button variant="secondary" onClick={handleClick} disabled={loading}>
        {loading ? "Sincronizando..." : label}
      </Button>
      {message ? <p className="text-xs text-slate-300">{message}</p> : null}
    </div>
  );
}
