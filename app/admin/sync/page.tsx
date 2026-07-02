import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { SyncTriggerButton } from "@/components/admin/sync-trigger-button";
import { requireAdminUser } from "@/lib/admin/rbac";
import { getRecentSyncRuns } from "@/lib/catalog/sync";
import { formatDate } from "@/lib/utils";

export default async function AdminSyncPage() {
  await requireAdminUser("admin.sync");
  const runs = await getRecentSyncRuns(20);

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Admin</p>
        <h1 className="section-title">Sincronizacoes</h1>
      </div>

      <Card className="flex flex-wrap gap-4">
        <SyncTriggerButton
          type="popular"
          label="Sincronizar populares"
          confirmMessage="Iniciar sincronizacao de series populares do TMDb agora?"
        />
        <SyncTriggerButton
          type="existing"
          label="Sincronizar series existentes"
          confirmMessage="Iniciar atualizacao das series ja catalogadas agora?"
        />
      </Card>

      {runs.length === 0 ? (
        <EmptyState title="Nenhuma sincronizacao ainda" copy="Dispare uma sincronizacao para ver o historico aqui." />
      ) : (
        <Card className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="text-xs uppercase tracking-wide text-slate-400">
              <tr>
                <th className="px-3 py-2">Data</th>
                <th className="px-3 py-2">Tipo</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2">Duracao</th>
                <th className="px-3 py-2">Importados</th>
                <th className="px-3 py-2">Atualizados</th>
                <th className="px-3 py-2">Erro</th>
              </tr>
            </thead>
            <tbody>
              {runs.map((run) => {
                const durationMs = run.finishedAt ? run.finishedAt.getTime() - run.startedAt.getTime() : null;
                return (
                  <tr key={run.id} className="border-t border-white/5">
                    <td className="px-3 py-2 text-slate-300">{formatDate(run.startedAt)}</td>
                    <td className="px-3 py-2 text-slate-300">{run.type}</td>
                    <td className="px-3 py-2">
                      <Badge>{run.status}</Badge>
                    </td>
                    <td className="px-3 py-2 text-slate-300">
                      {durationMs !== null ? `${(durationMs / 1000).toFixed(1)}s` : "em andamento"}
                    </td>
                    <td className="px-3 py-2 text-slate-300">{run.importedSeriesCount}</td>
                    <td className="px-3 py-2 text-slate-300">{run.updatedSeriesCount}</td>
                    <td className="px-3 py-2 text-slate-300">{run.errorMessage ?? "-"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
}
