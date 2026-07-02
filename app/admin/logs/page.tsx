import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { requireAdminUser } from "@/lib/admin/rbac";
import { getRecentAuditLogs } from "@/lib/admin/audit";
import { formatDate } from "@/lib/utils";

export default async function AdminLogsPage() {
  await requireAdminUser("admin.read");
  const logs = await getRecentAuditLogs(100);

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Admin</p>
        <h1 className="section-title">Logs de auditoria</h1>
      </div>

      {logs.length === 0 ? (
        <EmptyState title="Nenhum registro ainda" copy="Acoes administrativas aparecerao aqui." />
      ) : (
        <Card className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="text-xs uppercase tracking-wide text-slate-400">
              <tr>
                <th className="px-3 py-2">Data</th>
                <th className="px-3 py-2">Admin</th>
                <th className="px-3 py-2">Acao</th>
                <th className="px-3 py-2">Entidade</th>
                <th className="px-3 py-2">Id</th>
                <th className="px-3 py-2">Resultado</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((log) => (
                <tr key={log.id} className="border-t border-white/5">
                  <td className="px-3 py-2 text-slate-300">{formatDate(log.createdAt)}</td>
                  <td className="px-3 py-2 text-slate-300">@{log.adminUser.username}</td>
                  <td className="px-3 py-2 font-medium text-ink">{log.action}</td>
                  <td className="px-3 py-2 text-slate-300">{log.entity}</td>
                  <td className="px-3 py-2 text-slate-300">{log.entityId ?? "-"}</td>
                  <td className="px-3 py-2">
                    <Badge>{log.result}</Badge>
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
