import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Table, TableBody, TableContainer, TableHead, TableRow, Th, Td } from "@/components/ui/table";
import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { SupportRequestActions } from "@/components/admin/support-request-actions";
import { requireAdminUser } from "@/lib/admin/rbac";
import { listSupportRequests } from "@/lib/supporters/admin";
import { formatDate } from "@/lib/utils";

const STATUS_LABEL: Record<string, { label: string; variant: "default" | "primary" | "secondary" | "success" | "warning" | "danger" }> = {
  PENDING_PAYMENT: { label: "Aguardando pagamento", variant: "default" },
  AWAITING_REVIEW: { label: "Em analise", variant: "warning" },
  APPROVED: { label: "Aprovado", variant: "success" },
  REJECTED: { label: "Rejeitado", variant: "danger" },
  CANCELLED: { label: "Cancelado", variant: "default" }
};

/** INSERIES-SUPPORTER-ACTIVATION-01 — painel administrativo: toda solicitacao de apoio (qualquer status), com Aprovar/Rejeitar nas que estao AWAITING_REVIEW. */
export default async function AdminSupportersPage() {
  await requireAdminUser("admin.supporters");

  const requests = await listSupportRequests();

  return (
    <div className="space-y-6">
      <AdminPageHeader title="Apoiadores" description="Analise comprovantes de PIX e aprove ou rejeite solicitacoes de apoio." />

      {requests.length === 0 ? (
        <EmptyState title="Nenhuma solicitacao encontrada" copy="Ainda nao ha solicitacoes de apoio." />
      ) : (
        <Card padding="none">
          <TableContainer>
            <Table>
              <TableHead>
                <tr>
                  <Th>Usuario</Th>
                  <Th>Valor</Th>
                  <Th>Data</Th>
                  <Th>Comprovante</Th>
                  <Th>Status</Th>
                  <Th />
                </tr>
              </TableHead>
              <TableBody>
                {requests.map((request) => {
                  const status = STATUS_LABEL[request.status] ?? STATUS_LABEL.PENDING_PAYMENT;
                  return (
                    <TableRow key={request.id}>
                      <Td>
                        <p className="font-semibold text-ink">{request.user.name}</p>
                        <p className="text-xs text-subtle">@{request.user.username}</p>
                      </Td>
                      <Td className="text-muted">R$ {(request.amountCents / 100).toFixed(2)}</Td>
                      <Td className="text-muted">{formatDate(request.createdAt)}</Td>
                      <Td>
                        {request.receiptUrl ? (
                          <a href={request.receiptUrl} target="_blank" rel="noreferrer" className="inline-block">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={request.receiptUrl}
                              alt={`Comprovante de ${request.user.username}`}
                              className="h-12 w-12 rounded-lg border border-border object-cover"
                            />
                          </a>
                        ) : (
                          <span className="text-subtle">—</span>
                        )}
                      </Td>
                      <Td>
                        <Badge variant={status.variant}>{status.label}</Badge>
                      </Td>
                      <Td>{request.status === "AWAITING_REVIEW" ? <SupportRequestActions requestId={request.id} /> : null}</Td>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </TableContainer>
        </Card>
      )}
    </div>
  );
}
