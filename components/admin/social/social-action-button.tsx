"use client";

import { useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Button, type ButtonVariant } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { useToast } from "@/components/ui/toast";

/**
 * INSERIES-SOCIAL-ADMIN-PANEL-03 — the generic "admin action" button for this section, modeled
 * directly on components/admin/sync-trigger-button.tsx.
 *
 * It knows nothing about social automation: it POSTs a JSON body to `endpoint`, surfaces the
 * result as a toast and refreshes the route. Every decision (is this transition legal? is the CTA
 * valid?) belongs to the API route's package call, never here.
 */
export function SocialActionButton({
  endpoint,
  body,
  label,
  confirmTitle,
  confirmMessage,
  successMessage,
  variant = "secondary",
  size = "sm",
  disabled = false,
  icon
}: {
  endpoint: string;
  body?: Record<string, unknown>;
  label: string;
  confirmTitle: string;
  confirmMessage: string;
  successMessage: string;
  variant?: ButtonVariant;
  size?: "xs" | "sm" | "md" | "lg";
  disabled?: boolean;
  icon?: ReactNode;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleConfirm() {
    setLoading(true);

    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body ?? {})
      });
      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        toast({ title: "Acao nao concluida", description: data.message ?? data.error ?? "Erro desconhecido", variant: "error" });
      } else {
        toast({ title: successMessage, variant: "success" });
        router.refresh();
      }
    } catch {
      toast({ title: "Falha de rede", description: "Nao foi possivel completar a acao.", variant: "error" });
    } finally {
      setLoading(false);
      setOpen(false);
    }
  }

  return (
    <>
      <Button variant={variant} size={size} onClick={() => setOpen(true)} disabled={disabled}>
        {icon}
        {label}
      </Button>
      <ConfirmDialog
        open={open}
        onClose={() => setOpen(false)}
        onConfirm={handleConfirm}
        title={confirmTitle}
        description={confirmMessage}
        confirmLabel={label}
        confirmVariant={variant === "danger" ? "danger" : "primary"}
        loading={loading}
      />
    </>
  );
}
