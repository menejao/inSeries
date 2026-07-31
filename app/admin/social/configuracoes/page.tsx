import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert } from "@/components/ui/alert";
import { Table, TableBody, TableContainer, TableHead, TableRow, Th, Td } from "@/components/ui/table";
import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { AutomationToggle } from "@/components/admin/social/automation-toggle";
import { formatDateTime } from "@/components/admin/social/social-shared";
import { requireAdminUser } from "@/lib/admin/rbac";
import { describeConfig } from "@/packages/social-automation/src/config/describe";
import { getAutomationPauseState } from "@/packages/social-automation/src/settings";
import { listSeedCtasWithValidation } from "@/packages/social-automation/src/content-engine/cta-engine";
import { listNetworkPublisherStatuses } from "@/packages/social-automation/src/publisher/status";

export const dynamic = "force-dynamic";

/**
 * INSERIES-SOCIAL-ADMIN-PANEL-03 — Configuracoes.
 *
 * DECISION: read-only, except pause/resume.
 * packages/social-automation/src/config/index.ts zod-parses process.env once at module load; the
 * package has no settings repository and nothing persists these values, so an editable screen
 * would require inventing a runtime-settings system — new business logic, which this ticket
 * forbids. Values are therefore displayed with the env var that controls each one.
 * The single exception the ticket allows, "automacao ativa/pausada", is persisted through the
 * package's settings module into the pre-existing SystemSetting table (no schema change).
 */
export default async function AdminSocialSettingsPage() {
  await requireAdminUser("admin.social");

  const [pauseState] = await Promise.all([getAutomationPauseState()]);
  const groups = describeConfig();
  const ctas = listSeedCtasWithValidation();
  const networks = listNetworkPublisherStatuses();

  return (
    <div className="space-y-6">
      <AdminPageHeader title="Configuracoes" description="Configuracao atual da automacao social." />

      <Card className="space-y-3">
        <p className="text-sm font-semibold text-ink">Automacao</p>
        <AutomationToggle paused={pauseState.paused} reason={pauseState.reason} />
        <p className="text-xs text-subtle">
          Unica configuracao editavel em runtime. Persistida em SystemSetting (chave{" "}
          <code>social_automation.paused</code>). Ultima alteracao: {formatDateTime(pauseState.updatedAt)}.
        </p>
      </Card>

      <Alert variant="info" title="Demais configuracoes sao somente leitura">
        Os valores abaixo vem de variaveis de ambiente, lidas e validadas uma unica vez na inicializacao do pacote. Para
        alterar qualquer um deles, ajuste a variavel de ambiente correspondente e reinicie a aplicacao — nao existe
        persistencia de configuracao em runtime neste pacote.
      </Alert>

      {groups.map((group) => (
        <Card key={group.title} padding="none">
          <div className="border-b border-border px-5 py-3">
            <p className="text-sm font-semibold text-ink">{group.title}</p>
          </div>
          <TableContainer>
            <Table>
              <TableHead>
                <tr>
                  <Th>Configuracao</Th>
                  <Th>Valor atual</Th>
                  <Th>Variavel de ambiente</Th>
                </tr>
              </TableHead>
              <TableBody>
                {group.entries.map((entry) => (
                  <TableRow key={`${group.title}-${entry.label}`}>
                    <Td>
                      <span className="font-medium text-ink">{entry.label}</span>
                      {entry.note ? <span className="mt-0.5 block text-xs text-subtle">{entry.note}</span> : null}
                    </Td>
                    <Td className="text-muted">{entry.value}</Td>
                    <Td className="text-muted">{entry.envVar ? <code className="text-xs">{entry.envVar}</code> : "-"}</Td>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </Card>
      ))}

      <Card className="space-y-3">
        <p className="text-sm font-semibold text-ink">Redes e publishers</p>
        <div className="flex flex-wrap gap-3">
          {networks.map((network) => (
            <div key={network.network} className="rounded-2xl border border-border px-4 py-3">
              <p className="text-sm font-medium capitalize text-ink">{network.network}</p>
              <Badge variant={network.configured ? "success" : "warning"} className="mt-1">
                {network.label}
              </Badge>
              <p className="mt-1 text-xs text-subtle">Publisher: {network.publisherName}</p>
              <p className="text-xs text-subtle">Habilitada na config: {network.enabled ? "sim" : "nao"}</p>
            </div>
          ))}
        </div>
      </Card>

      <Card padding="none">
        <div className="border-b border-border px-5 py-3">
          <p className="text-sm font-semibold text-ink">Biblioteca de CTAs</p>
          <p className="mt-0.5 text-xs text-subtle">
            CTAs semente do content-engine, com o resultado da mesma validacao aplicada no backend.
          </p>
        </div>
        <TableContainer>
          <Table>
            <TableHead>
              <tr>
                <Th>ID</Th>
                <Th>Categoria</Th>
                <Th>Texto</Th>
                <Th>Validacao</Th>
              </tr>
            </TableHead>
            <TableBody>
              {ctas.map((cta) => (
                <TableRow key={cta.id}>
                  <Td className="text-muted">{cta.id}</Td>
                  <Td className="text-muted">{cta.category}</Td>
                  <Td className="text-muted">{cta.text}</Td>
                  <Td>
                    <Badge variant={cta.valid ? "success" : "danger"}>{cta.valid ? "Valido" : "Invalido"}</Badge>
                    {cta.warningMessages.length > 0 ? (
                      <span className="mt-1 block text-xs text-warning-text">{cta.warningMessages.join(" ")}</span>
                    ) : null}
                  </Td>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </Card>
    </div>
  );
}
