import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
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
      <div>
        <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Admin</p>
        <h1 className="section-title">Listas</h1>
      </div>

      {lists.length === 0 ? (
        <EmptyState title="Nenhuma lista encontrada" copy="Ainda nao ha listas cadastradas." />
      ) : (
        <Card className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="text-xs uppercase tracking-wide text-slate-400">
              <tr>
                <th className="px-3 py-2">Autor</th>
                <th className="px-3 py-2">Titulo</th>
                <th className="px-3 py-2">Series</th>
                <th className="px-3 py-2">Data</th>
                <th className="px-3 py-2">Visibilidade</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody>
              {lists.map((list) => (
                <tr key={list.id} className="border-t border-white/5">
                  <td className="px-3 py-2 text-slate-300">@{list.user.username}</td>
                  <td className="px-3 py-2 font-medium text-ink">{list.title}</td>
                  <td className="px-3 py-2 text-slate-300">{list._count.items}</td>
                  <td className="px-3 py-2 text-slate-300">{formatDate(list.updatedAt)}</td>
                  <td className="px-3 py-2">
                    <Badge>{list.visibility}</Badge>
                  </td>
                  <td className="px-3 py-2">
                    {list.hiddenByAdminAt ? <Badge>Oculta pelo admin</Badge> : <span className="text-slate-400">Visivel</span>}
                  </td>
                  <td className="px-3 py-2">
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
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
}
