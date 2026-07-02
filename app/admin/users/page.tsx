import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { requireAdminUser } from "@/lib/admin/rbac";
import { prisma } from "@/lib/db/prisma";
import { formatDate } from "@/lib/utils";

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
      <div>
        <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Admin</p>
        <h1 className="section-title">Usuarios</h1>
      </div>

      <Card>
        <form className="flex gap-2" method="get">
          <input
            type="text"
            name="q"
            defaultValue={q ?? ""}
            placeholder="Buscar por nome, usuario ou email..."
            className="min-h-11 flex-1 rounded-full border border-slate-600 bg-slate-900/70 px-4 text-sm text-ink"
          />
          <button
            type="submit"
            className="inline-flex min-h-11 items-center justify-center rounded-full bg-ember px-4 text-sm font-semibold text-night"
          >
            Buscar
          </button>
        </form>
      </Card>

      {users.length === 0 ? (
        <EmptyState title="Nenhum usuario encontrado" copy="Ajuste a busca para ver resultados." />
      ) : (
        <Card className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="text-xs uppercase tracking-wide text-slate-400">
              <tr>
                <th className="px-3 py-2">Nome</th>
                <th className="px-3 py-2">Usuario</th>
                <th className="px-3 py-2">Email</th>
                <th className="px-3 py-2">Papel</th>
                <th className="px-3 py-2">Cadastro</th>
                <th className="px-3 py-2">Ultimo acesso</th>
                <th className="px-3 py-2">Reviews</th>
                <th className="px-3 py-2">Listas</th>
                <th className="px-3 py-2">Seguidores</th>
                <th className="px-3 py-2">Seguindo</th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <tr key={user.id} className="border-t border-white/5">
                  <td className="px-3 py-2 font-medium text-ink">{user.name}</td>
                  <td className="px-3 py-2 text-slate-300">@{user.username}</td>
                  <td className="px-3 py-2 text-slate-300">{user.email}</td>
                  <td className="px-3 py-2">
                    <Badge>{user.role}</Badge>
                  </td>
                  <td className="px-3 py-2 text-slate-300">{formatDate(user.createdAt)}</td>
                  <td className="px-3 py-2 text-slate-300">{user.lastLoginAt ? formatDate(user.lastLoginAt) : "-"}</td>
                  <td className="px-3 py-2 text-slate-300">{user._count.reviews}</td>
                  <td className="px-3 py-2 text-slate-300">{user._count.lists}</td>
                  <td className="px-3 py-2 text-slate-300">{user._count.followers}</td>
                  <td className="px-3 py-2 text-slate-300">{user._count.following}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
}
