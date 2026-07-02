"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

export function FollowButton({
  username,
  initialFollowing,
  authenticated
}: {
  username: string;
  initialFollowing: boolean;
  authenticated: boolean;
}) {
  const router = useRouter();
  const [following, setFollowing] = useState(initialFollowing);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  if (!authenticated) {
    return (
      <Button variant="secondary" onClick={() => router.push("/login")}>
        Entrar para seguir
      </Button>
    );
  }

  return (
    <div className="space-y-2">
      <Button
        variant={following ? "secondary" : "primary"}
        disabled={isPending}
        onClick={() => {
          setError(null);
          startTransition(async () => {
            const response = await fetch(`/api/users/${username}/follow`, {
              method: following ? "DELETE" : "POST"
            });

            if (!response.ok) {
              const result = (await response.json().catch(() => ({}))) as { error?: string };
              setError(result.error ?? "request_failed");
              return;
            }

            setFollowing(!following);
            router.refresh();
          });
        }}
      >
        {isPending ? "Salvando..." : following ? "Deixar de seguir" : "Seguir"}
      </Button>
      {error ? <p className="text-xs text-rose-300">Erro: {error}</p> : null}
    </div>
  );
}
