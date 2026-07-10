import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { Table, TableBody, TableContainer, TableHead, TableRow, Th, Td } from "@/components/ui/table";
import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { ModerationButton } from "@/components/admin/moderation-button";
import { requireAdminUser } from "@/lib/admin/rbac";
import { prisma } from "@/lib/db/prisma";
import { formatDate } from "@/lib/utils";

export default async function AdminReviewsPage() {
  await requireAdminUser("admin.reviews");

  const reviews = await prisma.review.findMany({
    orderBy: { updatedAt: "desc" },
    take: 50,
    include: {
      user: { select: { username: true, name: true } },
      series: { select: { title: true } }
    }
  });

  return (
    <div className="space-y-6">
      <AdminPageHeader title="Reviews" description="Modere reviews publicadas na plataforma." />

      {reviews.length === 0 ? (
        <EmptyState title="Nenhuma review encontrada" copy="Ainda nao ha reviews cadastradas." />
      ) : (
        <Card padding="none">
          <TableContainer>
            <Table>
              <TableHead>
                <tr>
                  <Th>Autor</Th>
                  <Th>Serie</Th>
                  <Th>Nota</Th>
                  <Th>Data</Th>
                  <Th>Visibilidade</Th>
                  <Th>Status</Th>
                  <Th />
                </tr>
              </TableHead>
              <TableBody>
                {reviews.map((review) => (
                  <TableRow key={review.id}>
                    <Td className="text-muted">@{review.user.username}</Td>
                    <Td className="text-muted">{review.series.title}</Td>
                    <Td className="text-muted">{review.rating}/5</Td>
                    <Td className="text-muted">{formatDate(review.updatedAt)}</Td>
                    <Td>
                      <Badge variant={review.visibility === "PUBLIC" ? "secondary" : "default"}>{review.visibility}</Badge>
                    </Td>
                    <Td>
                      {review.hiddenByAdminAt ? <Badge variant="danger">Oculta pelo admin</Badge> : <span className="text-subtle">Visivel</span>}
                    </Td>
                    <Td>
                      {review.hiddenByAdminAt ? (
                        <ModerationButton
                          action="restore"
                          endpoint={`/api/admin/reviews/${review.id}/restore`}
                          confirmMessage="Restaurar esta review?"
                        />
                      ) : (
                        <ModerationButton
                          action="hide"
                          endpoint={`/api/admin/reviews/${review.id}/hide`}
                          confirmMessage="Ocultar esta review? Ela deixara de aparecer publicamente."
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
