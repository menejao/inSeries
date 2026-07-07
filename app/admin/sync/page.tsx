import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { Table, TableBody, TableContainer, TableHead, TableRow, Th, Td } from "@/components/ui/table";
import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { SyncTriggerButton } from "@/components/admin/sync-trigger-button";
import { requireAdminUser } from "@/lib/admin/rbac";
import { getRecentSyncRuns } from "@/lib/catalog/sync";
import { formatDate } from "@/lib/utils";

const statusVariant = { SUCCESS: "success", FAILED: "danger", RUNNING: "secondary" } as const;

export default async function AdminSyncPage() {
  await requireAdminUser("admin.sync");
  const runs = await getRecentSyncRuns(20);

  return (
    <div className="space-y-6">
      <AdminPageHeader title="Sincronizacoes" description="Dispare e acompanhe sincronizacoes com o TMDb." />

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
        <SyncTriggerButton
          type="discovery"
          label="Rodar Discovery Engine"
          confirmMessage="Rodar o Discovery Engine agora? Ranqueia e importa apenas as series mais relevantes (Trending/On The Air/Popular/Top Rated/Discover, com blacklist e limite por execucao)."
        />
      </Card>

      {runs.length === 0 ? (
        <EmptyState title="Nenhuma sincronizacao ainda" copy="Dispare uma sincronizacao para ver o historico aqui." />
      ) : (
        <Card padding="none">
          <TableContainer>
            <Table>
              <TableHead>
                <tr>
                  <Th>Data</Th>
                  <Th>Tipo</Th>
                  <Th>Status</Th>
                  <Th>Duracao</Th>
                  <Th>Importados</Th>
                  <Th>Atualizados</Th>
                  <Th>Erro</Th>
                </tr>
              </TableHead>
              <TableBody>
                {runs.map((run) => {
                  const durationMs = run.finishedAt ? run.finishedAt.getTime() - run.startedAt.getTime() : null;
                  return (
                    <TableRow key={run.id}>
                      <Td className="text-muted">{formatDate(run.startedAt)}</Td>
                      <Td className="text-muted">{run.type}</Td>
                      <Td>
                        <Badge variant={statusVariant[run.status as keyof typeof statusVariant] ?? "default"}>{run.status}</Badge>
                      </Td>
                      <Td className="text-muted">{durationMs !== null ? `${(durationMs / 1000).toFixed(1)}s` : "em andamento"}</Td>
                      <Td className="text-muted">{run.importedSeriesCount}</Td>
                      <Td className="text-muted">{run.updatedSeriesCount}</Td>
                      <Td className="text-muted">{run.errorMessage ?? "-"}</Td>
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
