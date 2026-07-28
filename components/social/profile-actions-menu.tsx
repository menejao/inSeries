"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Dropdown, DropdownItem, DropdownSeparator } from "@/components/ui/dropdown";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { IconButton } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { MoreHorizontalIcon, ShareIcon, EyeOffIcon, LockIcon, TrashIcon } from "@/components/ui/icons";

/**
 * Fase 6/12/13/14 (INSERIES-SOCIAL-NETWORK-EXPERIENCE-01) — "Mais acoes" do cabecalho de
 * perfil: silenciar, bloquear, remover seguidor (so quando essa pessoa segue o usuario
 * logado) e compartilhar. Denuncia fica de fora — nao ha sistema de moderacao de usuario
 * implementado neste ticket (Fase 39 e so a preparacao da arquitetura, nao a feature).
 */
export function ProfileActionsMenu({
  username,
  isMuted: initialMuted,
  isBlocked: initialBlocked,
  followsViewer
}: {
  username: string;
  isMuted: boolean;
  isBlocked: boolean;
  followsViewer: boolean;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [muted, setMuted] = useState(initialMuted);
  const [blocked, setBlocked] = useState(initialBlocked);
  const [confirmRemove, setConfirmRemove] = useState(false);
  const [confirmBlock, setConfirmBlock] = useState(false);
  const [isPending, startTransition] = useTransition();

  function toggleMute() {
    startTransition(async () => {
      const response = await fetch(`/api/users/${username}/mute`, { method: muted ? "DELETE" : "POST" });
      if (!response.ok) {
        toast({ title: "Nao foi possivel completar a acao", variant: "error" });
        return;
      }
      setMuted(!muted);
      router.refresh();
    });
  }

  function toggleBlock() {
    startTransition(async () => {
      const response = await fetch(`/api/users/${username}/block`, { method: blocked ? "DELETE" : "POST" });
      if (!response.ok) {
        toast({ title: "Nao foi possivel completar a acao", variant: "error" });
        return;
      }
      setBlocked(!blocked);
      setConfirmBlock(false);
      router.refresh();
    });
  }

  function removeFollower() {
    startTransition(async () => {
      const response = await fetch(`/api/users/${username}/remove-follower`, { method: "POST" });
      if (!response.ok) {
        toast({ title: "Nao foi possivel remover o seguidor", variant: "error" });
        return;
      }
      setConfirmRemove(false);
      router.refresh();
    });
  }

  return (
    <>
      <Dropdown
        trigger={
          <IconButton label="Mais acoes" variant="secondary">
            <MoreHorizontalIcon className="h-4 w-4" />
          </IconButton>
        }
      >
        <DropdownItem
          onClick={() => {
            void navigator.clipboard?.writeText(`${window.location.origin}/profile/${username}`);
            toast({ title: "Link do perfil copiado" });
          }}
        >
          <ShareIcon className="h-4 w-4" /> Compartilhar perfil
        </DropdownItem>
        <DropdownSeparator />
        <DropdownItem onClick={toggleMute} disabled={isPending}>
          <EyeOffIcon className="h-4 w-4" /> {muted ? "Deixar de silenciar" : "Silenciar"}
        </DropdownItem>
        {followsViewer ? (
          <DropdownItem onClick={() => setConfirmRemove(true)} disabled={isPending}>
            <TrashIcon className="h-4 w-4" /> Remover seguidor
          </DropdownItem>
        ) : null}
        <DropdownItem onClick={() => (blocked ? toggleBlock() : setConfirmBlock(true))} disabled={isPending} className="text-danger">
          <LockIcon className="h-4 w-4" /> {blocked ? "Desbloquear" : "Bloquear"}
        </DropdownItem>
      </Dropdown>

      <ConfirmDialog
        open={confirmRemove}
        onClose={() => setConfirmRemove(false)}
        onConfirm={removeFollower}
        title="Remover seguidor?"
        description="Essa pessoa deixara de seguir voce, mas ainda podera encontrar seu perfil caso ele seja publico."
        confirmLabel="Remover"
        confirmVariant="danger"
        loading={isPending}
      />

      <ConfirmDialog
        open={confirmBlock}
        onClose={() => setConfirmBlock(false)}
        onConfirm={toggleBlock}
        title="Bloquear este usuario?"
        description="Voces deixam de se seguir e nenhum dos dois podera interagir com o outro ate o bloqueio ser desfeito."
        confirmLabel="Bloquear"
        confirmVariant="danger"
        loading={isPending}
      />
    </>
  );
}
