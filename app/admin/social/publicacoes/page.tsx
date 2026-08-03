import Link from "next/link";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { EmptyState } from "@/components/ui/empty-state";
import { Table, TableBody, TableContainer, TableHead, TableRow, Th, Td } from "@/components/ui/table";
import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { PublicationRescheduleButton } from "@/components/admin/social/publication-reschedule-button";
import { PublicationCancelButton } from "@/components/admin/social/publication-cancel-button";
import { SocialActionButton } from "@/components/admin/social/social-action-button";
import {
  PublicationStatusBadge,
  IntegrationNotActiveWarning,
  MediaStorageNotConfiguredWarning,
  formatDateTime,
  toDateTimeLocalValue
} from "@/components/admin/social/social-shared";
import { requireAdminUser } from "@/lib/admin/rbac";
import { describeMediaStorageConfig } from "@/packages/social-automation/src/config";
import { publicationRepo } from "@/packages/social-automation/src/db/publication-repo";
import { listNetworkPublisherStatuses, noNetworkIsConfigured } from "@/packages/social-automation/src/publisher/status";
import type { SocialNetwork, SocialPublicationStatus } from "@prisma/client";

export const dynamic = "force-dynamic";

/**
 * INSERIES-INSTAGRAM-PUBLISHER-05 — UPLOADING/CANCELLED entram aqui como `string` porque o enum
 * gerado do Prisma ainda nao os conhece (a migracao deste ticket e aplicada manualmente, ver
 * CLAUDE.md). O filtro so precisa comparar texto, entao nao ha perda: quando a migracao rodar,
 * basta trocar o tipo de volta para SocialPublicationStatus[].
 */
const STATUSES: string[] = ["PENDING", "SCHEDULED", "UPLOADING", "PUBLISHING", "PUBLISHED", "FAILED", "CANCELLED"];
const NETWORKS: SocialNetwork[] = ["INSTAGRAM"];

/** Estados a partir dos quais o cancelamento e legal (espelha CANCELLABLE_STATUSES do pacote). */
const CANCELLABLE: string[] = ["PENDING", "SCHEDULED", "FAILED"];
/** Estados em que "Publicar agora" faz sentido. */
const PUBLISHABLE: string[] = ["PENDING", "SCHEDULED", "FAILED"];
/** Estados em que ainda faz sentido mover o horario. */
const RESCHEDULABLE: string[] = ["PENDING", "SCHEDULED", "FAILED"];

/** `attempts`/`lastError` ainda nao existem no client gerado — leitura defensiva ate a migracao. */
function readAttempts(publication: unknown): number {
  const value = (publication as { attempts?: unknown }).attempts;
  return typeof value === "number" ? value : 0;
}

function readLastError(publication: unknown): string | null {
  const value = (publication as { lastError?: unknown }).lastError;
  return typeof value === "string" && value.length > 0 ? value : null;
}

/** INSERIES-SOCIAL-ADMIN-PANEL-03 — publicacoes, com o aviso de integracao inativa sempre visivel. */
export default async function AdminSocialPublicationsPage({
  searchParams
}: {
  searchParams: Promise<{ status?: string; network?: string; page?: string }>;
}) {
  await requireAdminUser("admin.social");
  const params = await searchParams;

  const page = Number(params.page ?? "1");
  const result = await publicationRepo.listPaginated({
    status: params.status && STATUSES.includes(params.status) ? (params.status as SocialPublicationStatus) : null,
    network: NETWORKS.includes(params.network as SocialNetwork) ? (params.network as SocialNetwork) : null,
    page: Number.isFinite(page) ? page : 1,
    perPage: 20
  });

  const networks = listNetworkPublisherStatuses();
  const anyNetworkConfigured = !noNetworkIsConfigured();
  /**
   * INSERIES-SOCIAL-PUBLIC-MEDIA-STORAGE-07 — apenas a CONFIGURACAO e lida aqui (booleanos, nunca o
   * token, nunca uma URL assinada). O health check de verdade toca a rede, entao fica atras do botao
   * "Testar acesso" -> POST /api/admin/social/media-storage/health.
   */
  const mediaStorage = describeMediaStorageConfig();

  function pageHref(target: number) {
    const query = new URLSearchParams();
    if (params.status) query.set("status", params.status);
    if (params.network) query.set("network", params.network);
    query.set("page", String(target));
    return `/admin/social/publicacoes?${query.toString()}`;
  }

  return (
    <div className="space-y-6">
      <AdminPageHeader title="Publicacoes" description="Status real de cada publicacao registrada pelo pacote de automacao." />

      <IntegrationNotActiveWarning anyNetworkConfigured={anyNetworkConfigured} />

      <MediaStorageNotConfiguredWarning
        configured={mediaStorage.configured}
        tokenEnvVar={mediaStorage.tokenEnvVar}
        warning={mediaStorage.warning}
      />

      <Card padding="sm" className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm font-medium text-ink">Hospedagem publica das artes</p>
            <p className="text-xs text-muted">
              Onde os PNGs do Template Engine ficam acessiveis para a Meta buscar por URL anonima.
            </p>
          </div>
          <Badge variant={mediaStorage.configured ? "success" : "warning"}>
            {mediaStorage.configured ? "Configurada" : "Nao configurada"}
          </Badge>
        </div>

        <dl className="flex flex-wrap gap-x-6 gap-y-1 text-xs text-muted">
          <div>
            <dt className="inline font-medium text-ink">Provider: </dt>
            <dd className="inline">{mediaStorage.provider}</dd>
          </div>
          <div>
            <dt className="inline font-medium text-ink">Prefixo: </dt>
            <dd className="inline">{mediaStorage.prefix}</dd>
          </div>
          <div>
            <dt className="inline font-medium text-ink">Retencao: </dt>
            <dd className="inline">{mediaStorage.retentionHours}h</dd>
          </div>
          <div>
            <dt className="inline font-medium text-ink">Limite por arquivo: </dt>
            <dd className="inline">{Math.round(mediaStorage.maxBytes / 1024 / 1024)} MB</dd>
          </div>
          <div>
            <dt className="inline font-medium text-ink">{mediaStorage.tokenEnvVar}: </dt>
            <dd className="inline">{mediaStorage.hasToken ? "presente" : "ausente"}</dd>
          </div>
        </dl>

        <div className="flex flex-wrap gap-2">
          <SocialActionButton
            endpoint="/api/admin/social/media-storage/health"
            label="Testar acesso"
            size="xs"
            variant="ghost"
            confirmTitle="Testar acesso ao storage"
            confirmMessage="Somente leitura: confere a configuracao e se o prefixo pode ser listado. Nada e enviado nem apagado."
            successMessage="Acesso verificado"
          />
          <SocialActionButton
            endpoint="/api/admin/social/media-storage/health"
            body={{ write: true }}
            label="Testar escrita"
            size="xs"
            variant="secondary"
            disabled={!mediaStorage.configured}
            confirmTitle="Testar escrita no storage"
            confirmMessage="Envia um PNG 1x1 sob o prefixo _health/ e o apaga em seguida. Nenhuma publicacao e feita."
            successMessage="Escrita verificada"
          />
        </div>
      </Card>

      <Card padding="sm" className="flex flex-wrap gap-3">
        {networks.map((network) => (
          <div key={network.network} className="rounded-2xl border border-border px-3 py-2">
            <p className="text-xs font-medium capitalize text-ink">{network.network}</p>
            <Badge variant={network.configured ? "success" : "warning"} className="mt-1">
              {network.label}
            </Badge>
            {/* INSERIES-INSTAGRAM-PUBLISHER-05 — lacuna de infraestrutura explicita, nunca silenciosa. */}
            {network.mediaHostingConfigured ? null : (
              <p className="mt-1 max-w-64 text-xs text-muted">
                Sem hospedagem publica de imagem ({mediaStorage.tokenEnvVar}) — a Graph API precisa buscar o PNG por URL anonima.
              </p>
            )}
            {network.missingCredentials.length > 0 ? (
              <p className="mt-1 max-w-64 text-xs text-muted">Credenciais ausentes: {network.missingCredentials.join(", ")}</p>
            ) : null}
          </div>
        ))}
      </Card>

      <Card as="form" method="get" padding="sm" className="flex flex-wrap gap-3">
        <Select name="status" defaultValue={params.status ?? ""} aria-label="Status" className="max-w-48">
          <option value="">Todos os status</option>
          {STATUSES.map((status) => (
            <option key={status} value={status}>
              {status}
            </option>
          ))}
        </Select>
        <Select name="network" defaultValue={params.network ?? ""} aria-label="Rede" className="max-w-48">
          <option value="">Todas as redes</option>
          {NETWORKS.map((network) => (
            <option key={network} value={network}>
              {network}
            </option>
          ))}
        </Select>
        <Button type="submit">Filtrar</Button>
        <Link href="/admin/social/publicacoes" className={buttonVariants({ variant: "ghost" })}>
          Limpar
        </Link>
      </Card>

      {result.items.length === 0 ? (
        <EmptyState title="Nenhuma publicacao encontrada" copy="Aprove e agende um conteudo para criar uma publicacao." />
      ) : (
        <>
          <Card padding="none">
            <TableContainer>
              <Table>
                <TableHead>
                  <tr>
                    <Th>Conteudo</Th>
                    <Th>Rede</Th>
                    <Th>Status</Th>
                    <Th>Agendada para</Th>
                    <Th>Publicada em</Th>
                    <Th>ID externo</Th>
                    <Th>Tentativas</Th>
                    <Th>Ultimo erro</Th>
                    <Th />
                  </tr>
                </TableHead>
                <TableBody>
                  {result.items.map((publication) => (
                    <TableRow key={publication.id}>
                      <Td>
                        <Link href={`/admin/social/conteudos/${publication.contentId}`} className="font-medium text-ink hover:underline">
                          {publication.content.title}
                        </Link>
                      </Td>
                      <Td className="text-muted">{publication.network}</Td>
                      <Td>
                        <PublicationStatusBadge status={publication.status} />
                      </Td>
                      <Td className="text-muted">{formatDateTime(publication.scheduledFor)}</Td>
                      <Td className="text-muted">{formatDateTime(publication.publishedAt)}</Td>
                      <Td className="text-muted">{publication.externalId ?? "-"}</Td>
                      <Td className="text-muted">{readAttempts(publication)}</Td>
                      <Td className="max-w-64 truncate text-xs text-muted" title={readLastError(publication) ?? undefined}>
                        {readLastError(publication) ?? "-"}
                      </Td>
                      <Td>
                        <div className="flex flex-wrap items-center gap-1">
                          {PUBLISHABLE.includes(publication.status) ? (
                            <SocialActionButton
                              endpoint={`/api/admin/social/publications/${publication.id}/publish`}
                              body={{ force: true }}
                              label="Publicar"
                              size="xs"
                              confirmTitle="Publicar agora"
                              confirmMessage={
                                anyNetworkConfigured
                                  ? "A publicacao sera enviada a Meta Graph API imediatamente."
                                  : "Nenhum publisher real esta registrado: a acao percorre todo o fluxo interno sem enviar nada ao Instagram."
                              }
                              successMessage="Publicacao processada"
                            />
                          ) : null}
                          {RESCHEDULABLE.includes(publication.status) ? (
                            <PublicationRescheduleButton
                              publicationId={publication.id}
                              scheduledFor={toDateTimeLocalValue(publication.scheduledFor)}
                            />
                          ) : null}
                          {CANCELLABLE.includes(publication.status) ? <PublicationCancelButton publicationId={publication.id} /> : null}
                          {publication.externalId ? (
                            <SocialActionButton
                              endpoint={`/api/admin/social/publications/${publication.id}/refresh-status`}
                              label="Atualizar status"
                              size="xs"
                              variant="ghost"
                              confirmTitle="Atualizar status"
                              confirmMessage="Consulta a Meta Graph API o status atual desta publicacao. Nada e publicado."
                              successMessage="Status atualizado"
                            />
                          ) : null}
                        </div>
                      </Td>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </Card>

          <div className="flex items-center justify-between gap-3">
            <p className="text-xs text-muted">
              {result.total} publicacao(oes) · pagina {result.page} de {result.pageCount}
            </p>
            <div className="flex gap-2">
              {result.page > 1 ? (
                <Link href={pageHref(result.page - 1)} className={buttonVariants({ variant: "secondary", size: "sm" })}>
                  Anterior
                </Link>
              ) : null}
              {result.page < result.pageCount ? (
                <Link href={pageHref(result.page + 1)} className={buttonVariants({ variant: "secondary", size: "sm" })}>
                  Proxima
                </Link>
              ) : null}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
