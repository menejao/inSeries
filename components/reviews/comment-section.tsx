"use client";

import { useId, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { PencilIcon, TrashIcon } from "@/components/ui/icons";
import { useToast } from "@/components/ui/toast";
import { formatRelativeDate, getInitials } from "@/lib/utils";

type CommentUser = { id: string; name: string; username: string; avatarUrl: string | null };
export type ReplyItem = { id: string; body: string; createdAt: Date; userId: string; user: CommentUser };
export type CommentItem = { id: string; body: string; createdAt: Date; userId: string; user: CommentUser; replies: ReplyItem[] };

async function postComment(reviewId: string, body: string, parentId?: string) {
  const response = await fetch(`/api/reviews/${reviewId}/comments`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(parentId ? { body, parentId } : { body })
  });
  const result = (await response.json().catch(() => ({}))) as { error?: string };
  return { ok: response.ok, error: result.error };
}

async function patchComment(reviewId: string, commentId: string, body: string) {
  const response = await fetch(`/api/reviews/${reviewId}/comments/${commentId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ body })
  });
  const result = (await response.json().catch(() => ({}))) as { error?: string };
  return { ok: response.ok, error: result.error };
}

async function removeComment(reviewId: string, commentId: string) {
  const response = await fetch(`/api/reviews/${reviewId}/comments/${commentId}`, { method: "DELETE" });
  const result = (await response.json().catch(() => ({}))) as { error?: string };
  return { ok: response.ok, error: result.error };
}

function CommentRow({
  reviewId,
  comment,
  viewerId,
  isReply
}: {
  reviewId: string;
  comment: CommentItem | ReplyItem;
  viewerId?: string;
  isReply?: boolean;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const editId = useId();
  const [isPending, startTransition] = useTransition();
  const [isEditing, setIsEditing] = useState(false);
  const [editBody, setEditBody] = useState(comment.body);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const isOwn = viewerId === comment.userId;

  return (
    <div className="flex gap-2.5">
      <Link href={`/profile/${comment.user.username}`} className="shrink-0">
        <Avatar label={getInitials(comment.user.name)} name={comment.user.name} src={comment.user.avatarUrl} size="sm" />
      </Link>
      <div className="min-w-0 flex-1 space-y-1">
        <div className="flex flex-wrap items-baseline gap-x-2">
          <Link href={`/profile/${comment.user.username}`} className="text-sm font-semibold text-ink">
            @{comment.user.username}
          </Link>
          <span className="text-xs text-subtle">{formatRelativeDate(comment.createdAt)}</span>
        </div>

        {isEditing ? (
          <form
            className="space-y-2"
            onSubmit={(event) => {
              event.preventDefault();
              startTransition(async () => {
                const result = await patchComment(reviewId, comment.id, editBody);
                if (!result.ok) {
                  toast({ title: "Erro ao editar comentario", description: result.error, variant: "error" });
                  return;
                }
                setIsEditing(false);
                toast({ title: "Comentario atualizado", variant: "success" });
                router.refresh();
              });
            }}
          >
            <Textarea
              id={editId}
              value={editBody}
              onChange={(event) => setEditBody(event.target.value)}
              minLength={1}
              maxLength={1000}
              required
            />
            <div className="flex gap-2">
              <Button type="submit" size="sm" disabled={isPending} loading={isPending}>
                Salvar
              </Button>
              <Button type="button" variant="ghost" size="sm" disabled={isPending} onClick={() => setIsEditing(false)}>
                Cancelar
              </Button>
            </div>
          </form>
        ) : (
          <p className="text-sm text-muted">{comment.body}</p>
        )}

        {isOwn && !isEditing ? (
          <div className="flex gap-1">
            <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={() => setIsEditing(true)}>
              <PencilIcon className="h-3 w-3" /> Editar
            </Button>
            <Button variant="ghost" size="sm" className="h-7 px-2 text-xs text-danger-text" onClick={() => setConfirmingDelete(true)}>
              <TrashIcon className="h-3 w-3" /> Excluir
            </Button>
          </div>
        ) : null}
      </div>

      <ConfirmDialog
        open={confirmingDelete}
        onClose={() => setConfirmingDelete(false)}
        onConfirm={() => {
          startTransition(async () => {
            const result = await removeComment(reviewId, comment.id);
            if (!result.ok) {
              toast({ title: "Erro ao excluir comentario", description: result.error, variant: "error" });
              setConfirmingDelete(false);
              return;
            }
            setConfirmingDelete(false);
            toast({ title: isReply ? "Resposta excluida" : "Comentario excluido", variant: "success" });
            router.refresh();
          });
        }}
        title={isReply ? "Excluir resposta?" : "Excluir comentario?"}
        description={isReply ? "Essa acao nao pode ser desfeita." : "As respostas deste comentario tambem serao excluidas."}
        confirmLabel="Excluir"
        confirmVariant="danger"
        loading={isPending}
      />
    </div>
  );
}

function ReplyComposer({ reviewId, parentId, onDone }: { reviewId: string; parentId: string; onDone: () => void }) {
  const router = useRouter();
  const { toast } = useToast();
  const [body, setBody] = useState("");
  const [isPending, startTransition] = useTransition();

  return (
    <form
      className="ml-11 space-y-2"
      onSubmit={(event) => {
        event.preventDefault();
        startTransition(async () => {
          const result = await postComment(reviewId, body, parentId);
          if (!result.ok) {
            toast({ title: "Erro ao responder", description: result.error, variant: "error" });
            return;
          }
          setBody("");
          onDone();
          toast({ title: "Resposta publicada", variant: "success" });
          router.refresh();
        });
      }}
    >
      <Textarea
        value={body}
        onChange={(event) => setBody(event.target.value)}
        placeholder="Escreva uma resposta..."
        minLength={1}
        maxLength={1000}
        required
        autoFocus
      />
      <div className="flex gap-2">
        <Button type="submit" size="sm" disabled={isPending} loading={isPending}>
          Responder
        </Button>
        <Button type="button" variant="ghost" size="sm" disabled={isPending} onClick={onDone}>
          Cancelar
        </Button>
      </div>
    </form>
  );
}

/**
 * Fase 3/4 (INSERIES-REVIEWS-COMMENTS-PREMIUM-01) — comentarios reais (com uma camada de
 * respostas via `parentId`), CRUD completo para o dono do comentario, reutilizando o mesmo
 * padrao de mutacao (`useTransition` + fetch + toast + `router.refresh()`) usado em toda a
 * Minha Lista/Perfil. Sem curtidas (ver README, Fase 5 — decisao deliberada, fora do escopo).
 */
export function CommentSection({
  reviewId,
  comments,
  viewerId,
  authenticated
}: {
  reviewId: string;
  comments: CommentItem[];
  viewerId?: string;
  authenticated: boolean;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [newBody, setNewBody] = useState("");
  const [isPending, startTransition] = useTransition();
  const [expandedReplies, setExpandedReplies] = useState<Set<string>>(new Set());
  const [replyingTo, setReplyingTo] = useState<string | null>(null);

  function toggleReplies(commentId: string) {
    setExpandedReplies((current) => {
      const next = new Set(current);
      if (next.has(commentId)) {
        next.delete(commentId);
      } else {
        next.add(commentId);
      }
      return next;
    });
  }

  return (
    <div className="space-y-3 border-t border-border pt-3">
      {comments.length ? (
        <div className="space-y-3">
          {comments.map((comment) => (
            <div key={comment.id} className="space-y-2">
              <CommentRow reviewId={reviewId} comment={comment} viewerId={viewerId} />

              <div className="ml-11 flex items-center gap-3">
                {authenticated ? (
                  <button
                    type="button"
                    className="text-xs font-semibold text-subtle hover:text-ink"
                    onClick={() => setReplyingTo(replyingTo === comment.id ? null : comment.id)}
                  >
                    Responder
                  </button>
                ) : null}
                {comment.replies.length ? (
                  <button type="button" className="text-xs font-semibold text-subtle hover:text-ink" onClick={() => toggleReplies(comment.id)}>
                    {expandedReplies.has(comment.id)
                      ? "Ocultar respostas"
                      : `Ver ${comment.replies.length} resposta${comment.replies.length === 1 ? "" : "s"}`}
                  </button>
                ) : null}
              </div>

              {replyingTo === comment.id ? (
                <ReplyComposer reviewId={reviewId} parentId={comment.id} onDone={() => setReplyingTo(null)} />
              ) : null}

              {expandedReplies.has(comment.id) && comment.replies.length ? (
                <div className="ml-11 space-y-2 border-l border-border pl-3">
                  {comment.replies.map((reply) => (
                    <CommentRow key={reply.id} reviewId={reviewId} comment={reply} viewerId={viewerId} isReply />
                  ))}
                </div>
              ) : null}
            </div>
          ))}
        </div>
      ) : (
        <p className="text-xs text-subtle">Nenhum comentario ainda.</p>
      )}

      {authenticated ? (
        <form
          className="space-y-2"
          onSubmit={(event) => {
            event.preventDefault();
            startTransition(async () => {
              const result = await postComment(reviewId, newBody);
              if (!result.ok) {
                toast({ title: "Erro ao comentar", description: result.error, variant: "error" });
                return;
              }
              setNewBody("");
              toast({ title: "Comentario publicado", variant: "success" });
              router.refresh();
            });
          }}
        >
          <Textarea
            value={newBody}
            onChange={(event) => setNewBody(event.target.value)}
            placeholder="Comente esta review..."
            minLength={1}
            maxLength={1000}
            required
          />
          <Button type="submit" size="sm" disabled={isPending} loading={isPending}>
            Comentar
          </Button>
        </form>
      ) : null}
    </div>
  );
}
