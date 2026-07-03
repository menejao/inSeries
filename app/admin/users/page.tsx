import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { SearchBar } from "@/components/ui/search-bar";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableContainer, TableHead, TableRow, Th, Td } from "@/components/ui/table";
import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { requireAdminUser } from "@/lib/admin/rbac";
import { prisma } from "@/lib/db/prisma";
import { formatDate } from "@/lib/utils";

const roleVariant = { ADMIN: "danger", MODERATOR: "secondary", USER: "default" } as const;

export default async function AdminUsersPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  await requireAdminUser("admin.users");
  const { q } = await searchParams;

  const users = await prisma.user.findMany({
    where: q
      ? { OR: [{ name: { contains: q, mode: "insensitive" } }, { username: { contains: q, mode: "insensitive" } }, { email: { contains: q, mode: "insensitive" } }] }
      : undefined,
    orderBy: { createdAt: "desc" },
    take: 50,
    select: {
      id: true,
      name: true,
      username: true,
      email: true,
      role: true,
      createdAt: true,
      lastLoginAt: true,
      _count: { select: { reviews: true, lists: true, followers: true, following: true } }
    }
  });

  return (
    <div className="space-y-6">
      <AdminPageHeader title="Usuarios" description="Contas cadastradas na plataforma." />

      <Card as="form" method="get" padding="sm" className="flex gap-2">
        <SearchBar name="q" id="admin-users-search" label="Buscar usuarios" defaultValue={q ?? ""} placeholder="Buscar por nome, usuario ou email..." className="flex-1" />
        <Button type="submit">Buscar</Button>
      </Card>

      {users.length === 0 ? (
        <EmptyState title="Nenhum usuario encontrado" copy="Ajuste a busca para ver resultados." />
      ) : (
        <Card padding="none">
          <TableContainer>
            <Table>
              <TableHead>
                <tr>
                  <Th>Nome</Th>
                  <Th>Usuario</Th>
                  <Th>Email</Th>
                  <Th>Papel</Th>
                  <Th>Cadastro</Th>
                  <Th>Ultimo acesso</Th>
                  <Th>Reviews</Th>
                  <Th>Listas</Th>
                  <Th>Seguidores</Th>
                  <Th>Seguindo</Th>
                </tr>
              </TableHead>
              <TableBody>
                {users.map((user) => (
                  <TableRow key={user.id}>
                    <Td className="font-medium">{user.name}</Td>
                    <Td className="text-muted">@{user.username}</Td>
                    <Td className="text-muted">{user.email}</Td>
                    <Td>
                      <Badge variant={roleVariant[user.role]}>{user.role}</Badge>
                    </Td>
                    <Td className="text-muted">{formatDate(user.createdAt)}</Td>
                    <Td className="text-muted">{user.lastLoginAt ? formatDate(user.lastLoginAt) : "-"}</Td>
                    <Td className="text-muted">{user._count.reviews}</Td>
                    <Td className="text-muted">{user._count.lists}</Td>
                    <Td className="text-muted">{user._count.followers}</Td>
                    <Td className="text-muted">{user._count.following}</Td>
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
