import Link from "next/link";
import { Avatar } from "@/components/ui/avatar";
import { Card } from "@/components/ui/card";
import { getInitials } from "@/lib/utils";
import { FollowButton } from "@/components/social/follow-button";
import type { FollowState } from "@/lib/social/follow";

/**
 * Fase 10/11/15/16 (INSERIES-SOCIAL-NETWORK-EXPERIENCE-01) — linha reutilizada por
 * Seguindo/Seguidores/Explorar pessoas/Busca: avatar, nome, username, um sinal social
 * opcional (series em comum ou afinidade) e o botao Seguir. "Segue voce" so aparece na lista
 * de Seguidores (onde faz sentido) e nunca junto com o rotulo de compatibilidade — prioriza
 * o sinal mais util pra cada contexto.
 */
export function UserRow({
  user,
  followState,
  authenticated,
  followsViewer,
  mutualSeriesCount,
  affinityScore
}: {
  user: { id: string; name: string; username: string; avatarUrl: string | null };
  followState: FollowState;
  authenticated: boolean;
  followsViewer?: boolean;
  mutualSeriesCount?: number;
  affinityScore?: number | null;
}) {
  const signal =
    typeof affinityScore === "number"
      ? `${affinityScore}% de compatibilidade`
      : mutualSeriesCount
        ? `${mutualSeriesCount} serie${mutualSeriesCount === 1 ? "" : "s"} em comum`
        : null;

  return (
    <Card className="flex items-center gap-3">
      <Link href={`/profile/${user.username}`} className="shrink-0">
        <Avatar label={getInitials(user.name)} name={user.name} src={user.avatarUrl} size="sm" />
      </Link>
      <div className="min-w-0 flex-1">
        <Link href={`/profile/${user.username}`} className="line-clamp-1 font-semibold text-ink hover:underline">
          {user.name}
        </Link>
        <p className="line-clamp-1 text-sm text-muted">
          @{user.username}
          {followsViewer ? <span className="ml-1.5 text-xs text-subtle">· Segue voce</span> : null}
        </p>
        {signal ? <p className="mt-0.5 text-xs text-subtle">{signal}</p> : null}
      </div>
      <div className="shrink-0">
        <FollowButton username={user.username} initialState={followState} authenticated={authenticated} />
      </div>
    </Card>
  );
}
