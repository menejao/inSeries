"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Alert } from "@/components/ui/alert";
import { useToast } from "@/components/ui/toast";
import { SocialActionButton } from "@/components/admin/social/social-action-button";
import { validateCta } from "@/packages/social-automation/src/content-engine/cta-validation";

type ReviewStatus = "DRAFT" | "PENDING_APPROVAL" | "APPROVED" | "REJECTED" | "PUBLISHED" | "FAILED" | "ARCHIVED";

/**
 * INSERIES-SOCIAL-ADMIN-PANEL-03 — the action bar on the content review screen.
 *
 * Every button is a POST to app/api/admin/social/content/[id]/[action], which calls a
 * content-engine service. The only logic here is UX: which buttons make sense for the current
 * status (so we don't offer an action the backend would reject), loading/disabled state, and the
 * live CTA hint. That hint calls the SAME `validateCta` the backend enforces via assertValidCta —
 * it is a mirror for instant feedback, never the authority.
 */
export function ContentReviewActions({
  contentId,
  status,
  title,
  caption,
  ctaText,
  hashtags
}: {
  contentId: string;
  status: ReviewStatus;
  title: string;
  caption: string;
  ctaText: string;
  hashtags: string[];
}) {
  const router = useRouter();
  const { toast } = useToast();

  const [editOpen, setEditOpen] = useState(false);
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const [formTitle, setFormTitle] = useState(title);
  const [formCaption, setFormCaption] = useState(caption);
  const [formCta, setFormCta] = useState(ctaText);
  const [formHashtags, setFormHashtags] = useState(hashtags.join(" "));
  const [scheduledFor, setScheduledFor] = useState("");
  const [rejectReason, setRejectReason] = useState("");

  const ctaCheck = useMemo(() => validateCta(formCta), [formCta]);

  const isReviewable = status === "DRAFT" || status === "PENDING_APPROVAL";
  const canRevert = status === "PENDING_APPROVAL" || status === "APPROVED" || status === "REJECTED";

  async function post(endpoint: string, body: Record<string, unknown>, successMessage: string, onDone: () => void) {
    setLoading(true);

    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body)
      });
      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        toast({ title: "Acao nao concluida", description: data.message ?? data.error ?? "Erro desconhecido", variant: "error" });
      } else {
        toast({ title: successMessage, variant: "success" });
        onDone();
        router.refresh();
      }
    } catch {
      toast({ title: "Falha de rede", variant: "error" });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      {isReviewable ? (
        <>
          <SocialActionButton
            endpoint={`/api/admin/social/content/${contentId}/approve`}
            label="Aprovar"
            variant="primary"
            confirmTitle="Aprovar conteudo?"
            confirmMessage="O conteudo passa para APPROVED. Nenhuma publicacao real acontece — a integracao com o Instagram nao esta ativa."
            successMessage="Conteudo aprovado"
          />

          <Button variant="secondary" size="sm" onClick={() => setScheduleOpen(true)}>
            Aprovar e agendar
          </Button>

          <Button variant="secondary" size="sm" onClick={() => setEditOpen(true)}>
            Editar
          </Button>

          <Button variant="danger" size="sm" onClick={() => setRejectOpen(true)}>
            Rejeitar
          </Button>
        </>
      ) : null}

      {status === "DRAFT" ? (
        <SocialActionButton
          endpoint={`/api/admin/social/content/${contentId}/submit`}
          label="Enviar para revisao"
          confirmTitle="Enviar para revisao?"
          confirmMessage="O conteudo passa de DRAFT para PENDING_APPROVAL."
          successMessage="Enviado para revisao"
        />
      ) : null}

      {canRevert ? (
        <SocialActionButton
          endpoint={`/api/admin/social/content/${contentId}/draft`}
          label="Voltar para rascunho"
          confirmTitle="Voltar para rascunho?"
          confirmMessage="O conteudo volta ao status DRAFT e pode ser reeditado."
          successMessage="Conteudo voltou para rascunho"
        />
      ) : null}

      <SocialActionButton
        endpoint="/api/admin/social/generate"
        label="Gerar novamente"
        confirmTitle="Gerar um novo conteudo?"
        confirmMessage="Executa a mesma selecao de topico do CLI e cria um NOVO rascunho. O conteudo atual nao e alterado."
        successMessage="Novo conteudo gerado"
      />

      {/* ---- Editar ---- */}
      <Dialog
        open={editOpen}
        onClose={() => setEditOpen(false)}
        size="lg"
        title="Editar conteudo"
        description="As alteracoes sao validadas no backend antes de serem salvas."
        footer={
          <>
            <Button type="button" variant="ghost" onClick={() => setEditOpen(false)} disabled={loading}>
              Cancelar
            </Button>
            <Button
              type="button"
              loading={loading}
              disabled={!ctaCheck.valid}
              onClick={() =>
                post(
                  `/api/admin/social/content/${contentId}/edit`,
                  {
                    title: formTitle,
                    caption: formCaption,
                    ctaText: formCta,
                    hashtags: formHashtags.split(/\s+/).map((tag) => tag.trim()).filter(Boolean)
                  },
                  "Conteudo atualizado",
                  () => setEditOpen(false)
                )
              }
            >
              Salvar
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-ink" htmlFor="edit-title">
              Titulo
            </label>
            <Input id="edit-title" className="mt-2" value={formTitle} onChange={(event) => setFormTitle(event.target.value)} />
          </div>

          <div>
            <label className="block text-sm font-medium text-ink" htmlFor="edit-caption">
              Legenda
            </label>
            <Textarea id="edit-caption" className="mt-2 min-h-40" value={formCaption} onChange={(event) => setFormCaption(event.target.value)} />
          </div>

          <div>
            <label className="block text-sm font-medium text-ink" htmlFor="edit-cta">
              CTA
            </label>
            <Input id="edit-cta" className="mt-2" value={formCta} invalid={!ctaCheck.valid} onChange={(event) => setFormCta(event.target.value)} />
            {ctaCheck.errorMessages.length > 0 ? (
              <Alert variant="danger" className="mt-2">
                {ctaCheck.errorMessages.join(" ")}
              </Alert>
            ) : null}
            {ctaCheck.warningMessages.length > 0 ? (
              <Alert variant="warning" className="mt-2">
                {ctaCheck.warningMessages.join(" ")}
              </Alert>
            ) : null}
          </div>

          <div>
            <label className="block text-sm font-medium text-ink" htmlFor="edit-hashtags">
              Hashtags (separadas por espaco)
            </label>
            <Textarea id="edit-hashtags" className="mt-2 min-h-20" value={formHashtags} onChange={(event) => setFormHashtags(event.target.value)} />
          </div>
        </div>
      </Dialog>

      {/* ---- Aprovar e agendar ---- */}
      <Dialog
        open={scheduleOpen}
        onClose={() => setScheduleOpen(false)}
        title="Aprovar e agendar"
        description="Cria uma publicacao PENDING no horario escolhido. Nenhuma publicacao real ocorre — so o ConsoleLogPublisher existe hoje."
        footer={
          <>
            <Button type="button" variant="ghost" onClick={() => setScheduleOpen(false)} disabled={loading}>
              Cancelar
            </Button>
            <Button
              type="button"
              loading={loading}
              disabled={!scheduledFor}
              onClick={() =>
                post(
                  `/api/admin/social/content/${contentId}/schedule`,
                  { scheduledFor: new Date(scheduledFor).toISOString() },
                  "Conteudo aprovado e agendado",
                  () => setScheduleOpen(false)
                )
              }
            >
              Aprovar e agendar
            </Button>
          </>
        }
      >
        <label className="block text-sm font-medium text-ink" htmlFor="schedule-at">
          Data e hora
        </label>
        <Input
          id="schedule-at"
          type="datetime-local"
          className="mt-2"
          value={scheduledFor}
          onChange={(event) => setScheduledFor(event.target.value)}
        />
      </Dialog>

      {/* ---- Rejeitar ---- */}
      <Dialog
        open={rejectOpen}
        onClose={() => setRejectOpen(false)}
        title="Rejeitar conteudo?"
        description="O motivo fica registrado no historico e na auditoria administrativa."
        footer={
          <>
            <Button type="button" variant="ghost" onClick={() => setRejectOpen(false)} disabled={loading}>
              Cancelar
            </Button>
            <Button
              type="button"
              variant="danger"
              loading={loading}
              disabled={rejectReason.trim().length === 0}
              onClick={() =>
                post(
                  `/api/admin/social/content/${contentId}/reject`,
                  { reason: rejectReason },
                  "Conteudo rejeitado",
                  () => setRejectOpen(false)
                )
              }
            >
              Rejeitar
            </Button>
          </>
        }
      >
        <label className="block text-sm font-medium text-ink" htmlFor="reject-reason">
          Motivo (obrigatorio)
        </label>
        <Textarea id="reject-reason" className="mt-2" value={rejectReason} onChange={(event) => setRejectReason(event.target.value)} />
        {rejectReason.trim().length === 0 ? (
          <p className="mt-2 text-sm text-danger-text">Informe um motivo para rejeitar — ele fica registrado no historico.</p>
        ) : null}
      </Dialog>
    </div>
  );
}
