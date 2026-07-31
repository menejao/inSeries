"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";

/** INSERIES-SOCIAL-ADMIN-PANEL-03 — flips SocialTemplate.active through the API route. */
export function TemplateActiveToggle({ templateId, active }: { templateId: string; active: boolean }) {
  const router = useRouter();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);

  async function handleClick() {
    setLoading(true);

    try {
      const response = await fetch(`/api/admin/social/templates/${templateId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ active: !active })
      });
      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        toast({ title: "Nao foi possivel alterar o template", description: data.message ?? data.error, variant: "error" });
      } else {
        toast({ title: data.active ? "Template ativado" : "Template desativado", variant: "success" });
        router.refresh();
      }
    } catch {
      toast({ title: "Falha de rede", variant: "error" });
    } finally {
      setLoading(false);
    }
  }

  return (
    <Button variant={active ? "ghost" : "secondary"} size="xs" onClick={handleClick} loading={loading}>
      {active ? "Desativar" : "Ativar"}
    </Button>
  );
}
