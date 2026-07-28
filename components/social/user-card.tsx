import Link from "next/link";
import { Avatar } from "@/components/ui/avatar";
import { Card } from "@/components/ui/card";
import { getInitials } from "@/lib/utils";
import { FollowButton } from "@/components/social/follow-button";
import type { FollowState } from "@/lib/social/follow";

/**
 * Card compacto (grade), usado em blocos com muitos usuarios de uma vez ("Usuarios ativos"
 * em Explorar) — `UserRow` (linha larga) continua sendo o padrao pra listas com mais
 * contexto por item (Seguidores/Seguindo/sugestoes por afinidade).
 */
export function UserCard({
  user,
  followState,
  authenticated
}: {
  user: { id: string; name: string; username: string; avatarUrl: string | null };
  followState: FollowState;
  authenticated: boolean;
}) {
  return (
    <Card className="flex flex-col items-center gap-2 text-center">
      <Link href={`/profile/${user.username}`}>
        <Avatar label={getInitials(user.name)} name={user.name} src={user.avatarUrl} size="md" />
      </Link>
      <div className="min-w-0">
        <Link href={`/profile/${user.username}`} className="line-clamp-1 text-sm font-semibold text-ink hover:underline">
          {user.name}
        </Link>
        <p className="line-clamp-1 text-xs text-muted">@{user.username}</p>
      </div>
      <FollowButton username={user.username} initialState={followState} authenticated={authenticated} />
    </Card>
  );
}
