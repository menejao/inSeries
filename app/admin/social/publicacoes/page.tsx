import Link from "next/link";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { EmptyState } from "@/components/ui/empty-state";
import { Table, TableBody, TableContainer, TableHead, TableRow, Th, Td } from "@/components/ui/table";
import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { PublicationRescheduleButton } from "@/components/admin/social/publication-reschedule-button";
import { PublicationStatusBadge, IntegrationNotActiveWarning, formatDateTime, toDateTimeLocalValue } from "@/components/admin/social/social-shared";
import { requireAdminUser } from "@/lib/admin/rbac";
import { publicationRepo } from "@/packages/social-automation/src/db/publication-repo";
import { listNetworkPublisherStatuses, noNetworkIsConfigured } from "@/packages/social-automation/src/publisher/status";
import type { SocialNetwork, SocialPublicationStatus } from "@prisma/client";

export const dynamic = "force-dynamic";

const STATUSES: SocialPublicationStatus[] = ["PENDING", "SCHEDULED", "PUBLISHING", "PUBLISHED", "FAILED"];
const NETWORKS: SocialNetwork[] = ["INSTAGRAM"];

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
    status: STATUSES.includes(params.status as SocialPublicationStatus) ? (params.status as SocialPublicationStatus) : null,
    network: NETWORKS.includes(params.network as SocialNetwork) ? (params.network as SocialNetwork) : null,
    page: Number.isFinite(page) ? page : 1,
    perPage: 20
  });

  const networks = listNetworkPublisherStatuses();
  const anyNetworkConfigured = !noNetworkIsConfigured();

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

      <Card padding="sm" className="flex flex-wrap gap-3">
        {networks.map((network) => (
          <div key={network.network} className="rounded-2xl border border-border px-3 py-2">
            <p className="text-xs font-medium capitalize text-ink">{network.network}</p>
            <Badge variant={network.configured ? "success" : "warning"} className="mt-1">
              {network.label}
            </Badge>
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
