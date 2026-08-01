import Link from "next/link";
import { notFound } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert } from "@/components/ui/alert";
import { buttonVariants } from "@/components/ui/button";
import { Table, TableBody, TableContainer, TableHead, TableRow, Th, Td } from "@/components/ui/table";
import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { ContentReviewActions } from "@/components/admin/social/content-review-actions";
import { ContentArtPreview, type PreviewFormat } from "@/components/admin/social/content-art-preview";
import { PublicationRescheduleButton } from "@/components/admin/social/publication-reschedule-button";
import {
  ContentStatusBadge,
  PublicationStatusBadge,
  IntegrationNotActiveWarning,
  formatDateTime,
  toDateTimeLocalValue
} from "@/components/admin/social/social-shared";
import { requireAdminUser } from "@/lib/admin/rbac";
import { contentRepo } from "@/packages/social-automation/src/db/content-repo";
import { validateCta } from "@/packages/social-automation/src/content-engine/cta-validation";
import { availableFormats, getTemplateEntry } from "@/packages/social-automation/src/template-engine";
import { sanitizeJson, sanitizedJsonString } from "@/packages/social-automation/src/history/sanitize";
import { noNetworkIsConfigured } from "@/packages/social-automation/src/publisher/status";
import type { ContentPayload } from "@/packages/social-automation/src/content-engine/types";

export const dynamic = "force-dynamic";

/**
 * INSERIES-SOCIAL-ADMIN-PANEL-03 — tela de revisao completa.
 *
 * Pure rendering of the stored payload: the "carousel preview" is a structural render of
 * payload.items, never a generated image. Every JSON blob shown goes through the package's
 * sanitizeJson first, so a credential accidentally logged into a payload/detail can never surface
 * here. The CTA check displayed is the same validateCta the backend enforces on write.
 */
export default async function AdminSocialContentReviewPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdminUser("admin.social");
  const { id } = await params;

  const content = await contentRepo.findByIdWithRelations(id);
  if (!content) notFound();

  const payload = (content.payload as ContentPayload | null) ?? null;
  const ctaText = payload?.cta?.text ?? "";
  const ctaCheck = validateCta(ctaText);
  const carouselItems = payload?.items ?? [];

  // Formatos oferecidos pelo toggle de arte: vem do registry do Template Engine, nunca de heuristica.
  const templateEntry = payload?.templateKey ? getTemplateEntry(payload.templateKey) : null;
  const previewFormats = (payload?.templateKey ? availableFormats(payload.templateKey) : []) as PreviewFormat[];
  const anyNetworkConfigured = !noNetworkIsConfigured();

  // payload.extra carries the engine's own diagnostics (fallback used, repeat warnings, poll
  // options...). Sanitized before display like every other stored JSON.
  const extra = payload?.extra ? (sanitizeJson(payload.extra) as Record<string, unknown>) : null;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <AdminPageHeader title={content.title} description={`Formato: ${content.format ?? "-"} · criado em ${formatDateTime(content.createdAt)}`} />
        <Link href="/admin/social/conteudos" className={buttonVariants({ variant: "ghost", size: "sm" })}>
          Voltar para a lista
        </Link>
      </div>

      <Card className="flex flex-wrap items-center gap-3">
        <ContentStatusBadge status={content.status} />
        {content.template ? <Badge variant="outline">Template: {content.template.name}</Badge> : null}
        {content.hookId ? <Badge variant="outline">Hook: {content.hookId}</Badge> : null}
        {content.ctaId ? <Badge variant="outline">CTA: {content.ctaId}</Badge> : null}
      </Card>

      <Card className="space-y-4">
        <p className="text-sm font-semibold text-ink">Acoes</p>
        <ContentReviewActions
          contentId={content.id}
          status={content.status}
          title={content.title}
          caption={payload?.caption ?? content.description}
          ctaText={ctaText}
          hashtags={payload?.hashtags ?? []}
        />
      </Card>

      {!ctaCheck.valid ? (
        <Alert variant="danger" title="CTA invalido">
          {ctaCheck.errorMessages.join(" ")} A aprovacao sera recusada pelo backend ate que o CTA seja corrigido.
        </Alert>
      ) : ctaCheck.warningMessages.length > 0 ? (
        <Alert variant="warning" title="Atencao ao CTA">
          {ctaCheck.warningMessages.join(" ")}
        </Alert>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="space-y-3">
          <p className="text-sm font-semibold text-ink">Hook</p>
          <p className="text-sm text-muted">{payload?.hook ?? "-"}</p>

          <p className="pt-2 text-sm font-semibold text-ink">CTA</p>
          <p className="text-sm text-muted">{ctaText || "-"}</p>

          <p className="pt-2 text-sm font-semibold text-ink">Hashtags</p>
          <div className="flex flex-wrap gap-1.5">
            {(payload?.hashtags ?? []).length === 0 ? (
              <span className="text-sm text-muted">-</span>
            ) : (
              payload?.hashtags.map((tag) => (
                <Badge key={tag} variant="secondary">
                  {tag}
                </Badge>
              ))
            )}
          </div>
        </Card>

        <Card className="space-y-3">
          <p className="text-sm font-semibold text-ink">Legenda</p>
          <p className="whitespace-pre-wrap text-sm text-muted">{payload?.caption ?? content.description}</p>
        </Card>
      </div>

      <Card className="space-y-3">
        <p className="text-sm font-semibold text-ink">Serie principal</p>
        {payload?.sourceSeries ? (
          <div className="space-y-1 text-sm text-muted">
            <p className="font-medium text-ink">{payload.sourceSeries.title}</p>
            <p>
              {payload.sourceSeries.firstAirYear ?? "-"} · nota {payload.sourceSeries.voteAverage ?? "-"} ·{" "}
              {payload.sourceSeries.genres.join(", ") || "sem generos"}
            </p>
            {payload.sourceSeries.watchProviders.length > 0 ? <p>Disponivel em: {payload.sourceSeries.watchProviders.join(", ")}</p> : null}
          </div>
        ) : (
          <p className="text-sm text-muted">Sem serie principal associada.</p>
        )}
      </Card>

      {previewFormats.length > 0 ? (
        <Card className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-ink">Arte gerada (Template Engine)</p>
            <Badge variant="outline">{templateEntry?.nome ?? payload?.templateKey ?? "-"}</Badge>
          </div>
          <p className="text-xs text-subtle">
            PNG real renderizado sob demanda pelo mesmo renderer usado na publicacao — o que aparece aqui e exatamente o
            arquivo que seria enviado.
          </p>
          <ContentArtPreview contentId={content.id} formats={previewFormats} />
        </Card>
      ) : null}

      <Card className="space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold text-ink">Previa estrutural do carrossel</p>
          <Badge variant="outline">{carouselItems.length + (payload?.sourceSeries ? 1 : 0)} card(s)</Badge>
        </div>
        <p className="text-xs text-subtle">
          Renderizacao dos dados de payload.items — nenhuma imagem e gerada, e apenas a estrutura que um template usaria.
        </p>
        <div className="flex gap-3 overflow-x-auto pb-2">
          {payload?.sourceSeries ? (
            <div className="w-56 shrink-0 rounded-3xl border border-primary/40 bg-surface p-4">
              <p className="text-xs uppercase tracking-wide text-subtle">Card 1 · capa</p>
              <p className="mt-2 text-sm font-semibold text-ink">{payload.hook}</p>
              <p className="mt-1 text-xs text-muted">{payload.sourceSeries.title}</p>
            </div>
          ) : null}
          {carouselItems.map((item, index) => (
            <div key={`${item.id}-${index}`} className="w-56 shrink-0 rounded-3xl border border-border bg-surface p-4">
              <p className="text-xs uppercase tracking-wide text-subtle">Card {index + (payload?.sourceSeries ? 2 : 1)}</p>
              <p className="mt-2 text-sm font-semibold text-ink">{item.title}</p>
              <p className="mt-1 text-xs text-muted">
                {item.firstAirYear ?? "-"} · nota {item.voteAverage ?? "-"}
              </p>
              <p className="mt-1 text-xs text-subtle">{item.genres.slice(0, 3).join(", ")}</p>
            </div>
          ))}
          {carouselItems.length === 0 && !payload?.sourceSeries ? (
            <p className="text-sm text-muted">Este conteudo nao possui itens de carrossel.</p>
          ) : null}
        </div>
      </Card>

      {extra ? (
        <Card className="space-y-3">
          <p className="text-sm font-semibold text-ink">Diagnostico da geracao (payload.extra)</p>
          <pre className="overflow-x-auto rounded-2xl bg-surface-strong p-4 text-xs text-muted">{JSON.stringify(extra, null, 2)}</pre>
        </Card>
      ) : null}

      <Card className="space-y-3">
        <p className="text-sm font-semibold text-ink">Publicacoes</p>
        <IntegrationNotActiveWarning anyNetworkConfigured={anyNetworkConfigured} />
        {content.publications.length === 0 ? (
          <p className="text-sm text-muted">Nenhuma publicacao agendada para este conteudo.</p>
        ) : (
          <TableContainer>
            <Table>
              <TableHead>
                <tr>
                  <Th>Rede</Th>
                  <Th>Status</Th>
                  <Th>Agendada para</Th>
                  <Th>Publicada em</Th>
                  <Th />
                </tr>
              </TableHead>
              <TableBody>
                {content.publications.map((publication) => (
                  <TableRow key={publication.id}>
                    <Td className="text-muted">{publication.network}</Td>
                    <Td>
                      <PublicationStatusBadge status={publication.status} />
                    </Td>
                    <Td className="text-muted">{formatDateTime(publication.scheduledFor)}</Td>
                    <Td className="text-muted">{formatDateTime(publication.publishedAt)}</Td>
                    <Td>
                      {publication.status === "PUBLISHED" || publication.status === "PUBLISHING" ? null : (
                        <PublicationRescheduleButton
                          publicationId={publication.id}
                          scheduledFor={toDateTimeLocalValue(publication.scheduledFor)}
                        />
                      )}
                    </Td>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </Card>

      <Card className="space-y-3">
        <p className="text-sm font-semibold text-ink">Historico deste conteudo</p>
        {content.history.length === 0 ? (
          <p className="text-sm text-muted">Nenhum evento registrado.</p>
        ) : (
          <ol className="space-y-3 border-l border-border pl-4">
            {content.history.map((event) => (
              <li key={event.id} className="space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="outline">{event.action}</Badge>
                  <span className="text-xs text-subtle">{formatDateTime(event.createdAt)}</span>
                </div>
                {event.detail ? (
                  <pre className="overflow-x-auto rounded-2xl bg-surface-strong p-3 text-xs text-muted">
                    {sanitizedJsonString(event.detail)}
                  </pre>
                ) : null}
              </li>
            ))}
          </ol>
        )}
      </Card>
    </div>
  );
}
