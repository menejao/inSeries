import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { Table, TableBody, TableContainer, TableHead, TableRow, Th, Td } from "@/components/ui/table";
import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { requireAdminUser } from "@/lib/admin/rbac";
import { getRecentAuditLogs } from "@/lib/admin/audit";
import { formatDate } from "@/lib/utils";

const resultVariant = { SUCCESS: "success", FAILURE: "danger", REJECTED: "warning" } as const;

export default async function AdminLogsPage() {
  await requireAdminUser("admin.read");
  const logs = await getRecentAuditLogs(100);

  return (
    <div className="space-y-6">
      <AdminPageHeader title="Logs de auditoria" description="Historico de acoes administrativas." />

      {logs.length === 0 ? (
        <EmptyState title="Nenhum registro ainda" copy="Acoes administrativas aparecerao aqui." />
      ) : (
        <Card padding="none">
          <TableContainer>
            <Table>
              <TableHead>
                <tr>
                  <Th>Data</Th>
                  <Th>Admin</Th>
                  <Th>Acao</Th>
                  <Th>Entidade</Th>
                  <Th>Id</Th>
                  <Th>Resultado</Th>
                </tr>
              </TableHead>
              <TableBody>
                {logs.map((log) => (
                  <TableRow key={log.id}>
                    <Td className="text-muted">{formatDate(log.createdAt)}</Td>
                    <Td className="text-muted">@{log.adminUser.username}</Td>
                    <Td className="font-medium">{log.action}</Td>
                    <Td className="text-muted">{log.entity}</Td>
                    <Td className="text-muted">{log.entityId ?? "-"}</Td>
                    <Td>
                      <Badge variant={resultVariant[log.result as keyof typeof resultVariant] ?? "default"}>{log.result}</Badge>
                    </Td>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </Card>
      )}
    </div>
  );
}
