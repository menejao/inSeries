"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";

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
  const { toast } = useToast();
  const [following, setFollowing] = useState(initialFollowing);
  const [isPending, startTransition] = useTransition();

  if (!authenticated) {
    return (
      <Button variant="secondary" onClick={() => router.push("/login")}>
        Entrar para seguir
      </Button>
    );
  }

  return (
    <Button
      variant={following ? "secondary" : "primary"}
      disabled={isPending}
      loading={isPending}
      onClick={() => {
        startTransition(async () => {
          const response = await fetch(`/api/users/${username}/follow`, {
            method: following ? "DELETE" : "POST"
          });

          if (!response.ok) {
            const result = (await response.json().catch(() => ({}))) as { error?: string };
            toast({ title: "Erro ao seguir usuario", description: result.error, variant: "error" });
            return;
          }

          setFollowing(!following);
          router.refresh();
        });
      }}
    >
      {following ? "Deixar de seguir" : "Seguir"}
    </Button>
  );
}
