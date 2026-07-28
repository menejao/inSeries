"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { HeartIcon, MessageCircleIcon } from "@/components/ui/icons";
import { useToast } from "@/components/ui/toast";
import { cn, formatRelativeDate, getInitials } from "@/lib/utils";

type CommentUser = { id: string; name: string; username: string; avatarUrl: string | null };
type CommentItem = { id: string; body: string; createdAt: string; userId: string; user: CommentUser; replies: CommentItem[] };

/**
 * Fase 25/27/28 (INSERIES-SOCIAL-NETWORK-EXPERIENCE-01) — curtir + comentar direto no card de
 * atividade. Curtida e otimista (Fase 27); comentarios so carregam quando o usuario expande a
 * secao (evita 1 query extra por card do feed so pra mostrar uma lista quase sempre vazia).
 */
export function ActivityInteractionBar({
  activityId,
  initialLiked,
  initialLikeCount,
  initialCommentCount,
  authenticated
}: {
  activityId: string;
  initialLiked: boolean;
  initialLikeCount: number;
  initialCommentCount: number;
  authenticated: boolean;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [liked, setLiked] = useState(initialLiked);
  const [likeCount, setLikeCount] = useState(initialLikeCount);
  const [likePending, startLikeTransition] = useTransition();

  const [expanded, setExpanded] = useState(false);
  const [loadingComments, setLoadingComments] = useState(false);
  const [comments, setComments] = useState<CommentItem[] | null>(null);
  const [commentCount, setCommentCount] = useState(initialCommentCount);
  const [newBody, setNewBody] = useState("");
  const [isPosting, startPostTransition] = useTransition();

  function toggleLike() {
    if (!authenticated) {
      router.push("/login");
      return;
    }
    const wasLiked = liked;
    setLiked(!wasLiked);
    setLikeCount((count) => count + (wasLiked ? -1 : 1));

    startLikeTransition(async () => {
      const response = await fetch(`/api/activities/${activityId}/like`, { method: wasLiked ? "DELETE" : "POST" });
      if (!response.ok) {
        setLiked(wasLiked);
        setLikeCount((count) => count + (wasLiked ? 1 : -1));
        toast({ title: "Nao foi possivel curtir", variant: "error" });
      }
    });
  }

  async function toggleExpand() {
    const next = !expanded;
    setExpanded(next);
    if (next && comments === null) {
      setLoadingComments(true);
      const response = await fetch(`/api/activities/${activityId}/comments`);
      const payload = (await response.json().catch(() => ({ data: [] }))) as { data: CommentItem[] };
      setComments(payload.data ?? []);
      setLoadingComments(false);
    }
  }

  function submitComment() {
    startPostTransition(async () => {
      const response = await fetch(`/api/activities/${activityId}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body: newBody })
      });
      if (!response.ok) {
        toast({ title: "Nao foi possivel comentar", variant: "error" });
        return;
      }
      const payload = (await response.json()) as { data: CommentItem };
      setComments((current) => [...(current ?? []), { ...payload.data, replies: [] }]);
      setCommentCount((count) => count + 1);
      setNewBody("");
    });
  }

  return (
    <div className="space-y-2.5 border-t border-border pt-2.5">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={toggleLike}
          disabled={likePending}
          aria-pressed={liked}
          aria-label={liked ? "Descurtir atividade" : "Curtir atividade"}
          className={cn(
            "flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold transition",
            liked ? "bg-danger/10 text-danger-text" : "text-subtle hover:bg-surface hover:text-ink"
          )}
        >
          <HeartIcon className={cn("h-3.5 w-3.5", liked && "fill-current")} /> {likeCount > 0 ? likeCount : "Curtir"}
        </button>
        <button
          type="button"
          onClick={toggleExpand}
          className="flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold text-subtle transition hover:bg-surface hover:text-ink"
        >
          <MessageCircleIcon className="h-3.5 w-3.5" /> {commentCount > 0 ? commentCount : "Comentar"}
        </button>
      </div>

      {expanded ? (
        <div className="space-y-3 pl-1">
          {loadingComments ? (
            <p className="text-xs text-subtle">Carregando comentarios...</p>
          ) : comments?.length ? (
            <div className="space-y-2.5">
              {comments.map((comment) => (
                <div key={comment.id} className="flex gap-2">
                  <Link href={`/profile/${comment.user.username}`} className="shrink-0">
                    <Avatar label={getInitials(comment.user.name)} name={comment.user.name} src={comment.user.avatarUrl} size="sm" />
                  </Link>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs">
                      <Link href={`/profile/${comment.user.username}`} className="font-semibold text-ink">
                        @{comment.user.username}
                      </Link>{" "}
                      <span className="text-subtle">{formatRelativeDate(new Date(comment.createdAt))}</span>
                    </p>
                    <p className="text-sm text-muted">{comment.body}</p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-subtle">Nenhum comentario ainda.</p>
          )}

          {authenticated ? (
            <div className="flex items-start gap-2">
              <Textarea
                value={newBody}
                onChange={(event) => setNewBody(event.target.value)}
                placeholder="Escreva um comentario..."
                maxLength={500}
                className="min-h-16 text-sm"
              />
              <Button size="sm" disabled={isPosting || !newBody.trim()} loading={isPosting} onClick={submitComment}>
                Enviar
              </Button>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
