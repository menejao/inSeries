"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import type { FollowState } from "@/lib/social/follow";

const LABELS: Record<FollowState, string> = {
  self: "",
  following: "Seguindo",
  requested: "Solicitado",
  none: "Seguir"
};

/**
 * Fase 7/32 (INSERIES-SOCIAL-NETWORK-EXPERIENCE-01) — 3 estados reais: "Seguir" (perfil
 * publico ou ainda nao solicitado), "Solicitado" (perfil privado, aguardando aprovacao —
 * clicar de novo cancela a solicitacao) e "Seguindo" (clicar de novo deixa de seguir).
 * Atualizacao otimista com rollback em erro (Fase 7).
 */
export function FollowButton({
  username,
  initialState,
  authenticated
}: {
  username: string;
  initialState: FollowState;
  authenticated: boolean;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [state, setState] = useState<FollowState>(initialState);
  const [isPending, startTransition] = useTransition();

  if (state === "self") return null;

  if (!authenticated) {
    return (
      <Button variant="secondary" onClick={() => router.push("/login")}>
        Entrar para seguir
      </Button>
    );
  }

  const isActive = state === "following" || state === "requested";
  const label = isPending ? "..." : LABELS[state];
  const ariaLabel = state === "following" ? `Deixar de seguir @${username}` : `Seguir @${username}`;

  return (
    <Button
      variant={isActive ? "secondary" : "primary"}
      disabled={isPending}
      loading={isPending}
      aria-label={ariaLabel}
      onClick={() => {
        const previous = state;
        const optimistic: FollowState = isActive ? "none" : "requested";
        setState(optimistic);

        startTransition(async () => {
          const response = await fetch(`/api/users/${username}/follow`, {
            method: isActive ? "DELETE" : "POST"
          });

          if (!response.ok) {
            setState(previous);
            const result = (await response.json().catch(() => ({}))) as { error?: string };
            toast({ title: "Erro ao seguir usuario", description: result.error, variant: "error" });
            return;
          }

          const payload = (await response.json()) as { data: { state: FollowState } };
          setState(payload.data.state);
          router.refresh();
        });
      }}
    >
      {label}
    </Button>
  );
}
