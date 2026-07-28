"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Avatar } from "@/components/ui/avatar";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { getInitials } from "@/lib/utils";

export type PendingFollowRequest = {
  id: string;
  requester: { id: string; name: string; username: string; avatarUrl: string | null };
};

/**
 * Fase 4/32 (INSERIES-SOCIAL-NETWORK-EXPERIENCE-01) — visivel so pro dono do perfil (perfil
 * privado): solicitacoes pendentes, aceitar/rejeitar direto na lista. Some quando nao ha
 * pendencias, nao ocupa espaco por padrao.
 */
export function FollowRequestsPanel({ requests }: { requests: PendingFollowRequest[] }) {
  const router = useRouter();
  const [items, setItems] = useState(requests);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  if (!items.length) return null;

  function respond(id: string, action: "accept" | "reject") {
    setPendingId(id);
    startTransition(async () => {
      await fetch(`/api/follow-requests/${id}/${action}`, { method: "POST" });
      setItems((current) => current.filter((item) => item.id !== id));
      setPendingId(null);
      router.refresh();
    });
  }

  return (
    <Card className="space-y-3">
      <h2 className="section-title text-lg">Solicitacoes para seguir voce</h2>
      <div className="space-y-2">
        {items.map((request) => (
          <div key={request.id} className="flex items-center gap-3">
            <Link href={`/profile/${request.requester.username}`} className="shrink-0">
              <Avatar label={getInitials(request.requester.name)} name={request.requester.name} src={request.requester.avatarUrl} size="sm" />
            </Link>
            <div className="min-w-0 flex-1">
              <Link href={`/profile/${request.requester.username}`} className="line-clamp-1 font-semibold text-ink hover:underline">
                {request.requester.name}
              </Link>
              <p className="line-clamp-1 text-sm text-muted">@{request.requester.username}</p>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <Button
                size="sm"
                variant="primary"
                loading={pendingId === request.id}
                disabled={pendingId !== null}
                onClick={() => respond(request.id, "accept")}
              >
                Aceitar
              </Button>
              <Button
                size="sm"
                variant="secondary"
                disabled={pendingId !== null}
                onClick={() => respond(request.id, "reject")}
              >
                Rejeitar
              </Button>
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}
