import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { Table, TableBody, TableContainer, TableHead, TableRow, Th, Td } from "@/components/ui/table";
import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { ModerationButton } from "@/components/admin/moderation-button";
import { requireAdminUser } from "@/lib/admin/rbac";
import { prisma } from "@/lib/db/prisma";
import { formatDate } from "@/lib/utils";

export default async function AdminListsPage() {
  await requireAdminUser("admin.lists");

  const lists = await prisma.list.findMany({
    orderBy: { updatedAt: "desc" },
    take: 50,
    include: {
      user: { select: { username: true, name: true } },
      _count: { select: { items: true } }
    }
  });

  return (
    <div className="space-y-6">
      <AdminPageHeader title="Listas" description="Modere listas publicas criadas pela comunidade." />

      {lists.length === 0 ? (
        <EmptyState title="Nenhuma lista encontrada" copy="Ainda nao ha listas cadastradas." />
      ) : (
        <Card padding="none">
          <TableContainer>
            <Table>
              <TableHead>
                <tr>
                  <Th>Autor</Th>
                  <Th>Titulo</Th>
                  <Th>Series</Th>
                  <Th>Data</Th>
                  <Th>Visibilidade</Th>
                  <Th>Status</Th>
                  <Th />
                </tr>
              </TableHead>
              <TableBody>
                {lists.map((list) => (
                  <TableRow key={list.id}>
                    <Td className="text-muted">@{list.user.username}</Td>
                    <Td className="font-medium">{list.title}</Td>
                    <Td className="text-muted">{list._count.items}</Td>
                    <Td className="text-muted">{formatDate(list.updatedAt)}</Td>
                    <Td>
                      <Badge variant={list.visibility === "PUBLIC" ? "secondary" : "default"}>{list.visibility}</Badge>
                    </Td>
                    <Td>
                      {list.hiddenByAdminAt ? <Badge variant="danger">Oculta pelo admin</Badge> : <span className="text-subtle">Visivel</span>}
                    </Td>
                    <Td>
                      {list.hiddenByAdminAt ? (
                        <ModerationButton
                          action="restore"
                          endpoint={`/api/admin/lists/${list.id}/restore`}
                          confirmMessage="Restaurar esta lista?"
                        />
                      ) : (
                        <ModerationButton
                          action="hide"
                          endpoint={`/api/admin/lists/${list.id}/hide`}
                          confirmMessage="Ocultar esta lista? Ela deixara de aparecer publicamente."
                        />
                      )}
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
