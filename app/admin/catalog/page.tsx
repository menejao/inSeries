import Link from "next/link";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { SearchBar } from "@/components/ui/search-bar";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableContainer, TableHead, TableRow, Th, Td } from "@/components/ui/table";
import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { getStatusBadgeVariant, getStatusLabel } from "@/lib/catalog/status-labels";
import { requireAdminUser } from "@/lib/admin/rbac";
import { prisma } from "@/lib/db/prisma";

export default async function AdminCatalogPage({
  searchParams
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  await requireAdminUser("admin.catalog");
  const { q } = await searchParams;

  const series = await prisma.series.findMany({
    where: q
      ? {
          OR: [
            { title: { contains: q, mode: "insensitive" } },
            { originalTitle: { contains: q, mode: "insensitive" } }
          ]
        }
      : undefined,
    orderBy: [{ popularityScore: "desc" }, { createdAt: "desc" }],
    take: 50,
    include: { _count: { select: { seasons: true } } }
  });

  return (
    <div className="space-y-6">
      <AdminPageHeader title="Catalogo" description="Series sincronizadas no banco local." />

      <Card as="form" method="get" padding="sm" className="flex gap-2">
        <SearchBar name="q" id="admin-catalog-search" label="Buscar series por titulo" defaultValue={q ?? ""} placeholder="Buscar por titulo..." className="flex-1" />
        <Button type="submit">Buscar</Button>
      </Card>

      {series.length === 0 ? (
        <EmptyState title="Nenhuma serie encontrada" copy="Ajuste a busca ou sincronize o catalogo." />
      ) : (
        <Card padding="none">
          <TableContainer>
            <Table>
              <TableHead>
                <tr>
                  <Th>Titulo</Th>
                  <Th>Status</Th>
                  <Th>Ano</Th>
                  <Th>Temporadas</Th>
                  <Th>Popularidade</Th>
                  <Th>Nota TMDb</Th>
                  <Th />
                </tr>
              </TableHead>
              <TableBody>
                {series.map((item) => (
                  <TableRow key={item.id}>
                    <Td className="font-medium">{item.title}</Td>
                    <Td>
                      <Badge variant={getStatusBadgeVariant(item.status)}>{getStatusLabel(item.status)}</Badge>
                    </Td>
                    <Td className="text-muted">{item.firstAirYear ?? "-"}</Td>
                    <Td className="text-muted">{item._count.seasons}</Td>
                    <Td className="text-muted">{item.popularityScore?.toFixed(1) ?? "-"}</Td>
                    <Td className="text-muted">{item.voteAverage?.toFixed(1) ?? "-"}</Td>
                    <Td>
                      <Link href={`/admin/catalog/${item.id}`} className="link-accent">
                        Ver detalhes
                      </Link>
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
