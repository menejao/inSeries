import { readdirSync } from "node:fs";
import { join } from "node:path";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableContainer, TableHead, TableRow, Th, Td } from "@/components/ui/table";
import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { requireAdminUser } from "@/lib/admin/rbac";
import { canUseDatabase } from "@/lib/db/health";
import { config, getPublicConfig } from "@/lib/config";
import { getAllFeatureFlags } from "@/lib/config/flags";
import { getHealthSnapshot, getReadySnapshot } from "@/lib/health/service";
import { getMetricsSnapshot } from "@/lib/metrics/service";
import { listSystemSettings } from "@/lib/system-settings/service";
import { RECOMMENDATION_PROVIDERS } from "@/lib/recommendations";
import packageJson from "@/package.json";
import prismaClientPackageJson from "@prisma/client/package.json";

function getSanitizedDatabaseTarget() {
  const raw = config.database.url;
  if (!raw) return "nao configurado";

  try {
    const url = new URL(raw);
    return `${url.hostname}${url.port ? `:${url.port}` : ""}${url.pathname}`;
  } catch {
    return "indisponivel";
  }
}

function countMigrations() {
  try {
    const migrationsDir = join(process.cwd(), "prisma", "migrations");
    return readdirSync(migrationsDir, { withFileTypes: true }).filter((entry) => entry.isDirectory()).length;
  } catch {
    return 0;
  }
}

export default async function AdminSystemPage() {
  await requireAdminUser("admin.system");

  const [dbOnline, health, ready, systemSettings] = await Promise.all([
    canUseDatabase(),
    Promise.resolve(getHealthSnapshot()),
    getReadySnapshot(),
    listSystemSettings()
  ]);

  const migrationCount = countMigrations();
  const metrics = getMetricsSnapshot();
  const featureFlags = getAllFeatureFlags();
  const publicConfig = getPublicConfig();

  const infoRows: { label: string; value: string }[] = [
    { label: "Versao da aplicacao", value: packageJson.version },
    { label: "Ambiente", value: config.app.env },
    { label: "Versao do Prisma", value: prismaClientPackageJson.version },
    { label: "Banco de dados", value: getSanitizedDatabaseTarget() },
    { label: "Migrations aplicadas", value: String(migrationCount) },
    { label: "Versao do Node", value: process.version }
  ];

  const metricRows: { label: string; value: string }[] = [
    { label: "Total de requests", value: String(metrics.totalRequests) },
    { label: "Tempo medio de resposta", value: `${metrics.averageResponseTimeMs}ms` },
    { label: "Erros 4xx", value: String(metrics.status4xx) },
    { label: "Erros 5xx", value: String(metrics.status5xx) },
    { label: "Logins", value: String(metrics.logins) },
    { label: "Cadastros", value: String(metrics.registrations) },
    { label: "Syncs iniciados", value: String(metrics.syncsStarted) },
    { label: "Notificacoes criadas", value: String(metrics.notificationsCreated) },
    { label: "Atividades criadas", value: String(metrics.activitiesCreated) }
  ];

  return (
    <div className="space-y-6">
      <AdminPageHeader title="Sistema" description="Configuracao, saude e metricas da aplicacao." />

      <Card className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm text-muted">Status do banco:</span>
          <Badge variant={dbOnline ? "success" : "danger"}>{dbOnline ? "Online" : "Indisponivel"}</Badge>
          <span className="text-sm text-muted">Health:</span>
          <Badge variant={health.status === "ok" ? "success" : "danger"}>{health.status}</Badge>
          <span className="text-sm text-muted">Ready:</span>
          <Badge variant={ready.status === "ready" ? "success" : "danger"}>{ready.status}</Badge>
        </div>
        <p className="text-xs text-subtle">
          Ready checks: configuracao={String(ready.checks.configuration)}, banco={String(ready.checks.database)}
        </p>
        <dl className="grid gap-3 sm:grid-cols-2">
          {infoRows.map((row) => (
            <div key={row.label} className="rounded-2xl border border-border bg-surface-strong/50 p-3">
              <dt className="text-xs uppercase tracking-[0.2em] text-subtle">{row.label}</dt>
              <dd className="mt-1 text-sm font-medium text-ink">{row.value}</dd>
            </div>
          ))}
        </dl>
      </Card>

      <Card className="space-y-3">
        <h2 className="text-lg font-semibold text-ink">Feature flags</h2>
        <div className="flex flex-wrap gap-2">
          {Object.entries(featureFlags).map(([flag, enabled]) => (
            <Badge key={flag} variant={enabled ? "success" : "default"}>
              {flag}: {enabled ? "on" : "off"}
            </Badge>
          ))}
        </div>
      </Card>

      <Card className="space-y-3">
        <h2 className="text-lg font-semibold text-ink">Metricas basicas</h2>
        <p className="text-xs text-subtle">Em memoria desde {new Date(metrics.startedAt).toLocaleString("pt-BR")}. Reinicia a cada deploy/restart.</p>
        <dl className="grid gap-3 sm:grid-cols-3">
          {metricRows.map((row) => (
            <div key={row.label} className="rounded-2xl border border-border bg-surface-strong/50 p-3">
              <dt className="text-xs uppercase tracking-[0.2em] text-subtle">{row.label}</dt>
              <dd className="mt-1 text-sm font-medium text-ink">{row.value}</dd>
            </div>
          ))}
        </dl>
      </Card>

      <Card className="space-y-3">
        <div className="flex items-center gap-2">
          <h2 className="text-lg font-semibold text-ink">Motor de recomendacoes</h2>
          <Badge variant={featureFlags.recommendations ? "success" : "default"}>
            {featureFlags.recommendations ? "ativo" : "desligado"}
          </Badge>
        </div>
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-subtle">Providers e pesos</p>
          <dl className="mt-2 grid gap-3 sm:grid-cols-3">
            {RECOMMENDATION_PROVIDERS.map((provider) => (
              <div key={provider.id} className="rounded-2xl border border-border bg-surface-strong/50 p-3">
                <dt className="text-xs uppercase tracking-[0.2em] text-subtle">{provider.label}</dt>
                <dd className="mt-1 text-sm font-medium text-ink">peso {publicConfig.recommendations.weights[provider.id]}</dd>
              </div>
            ))}
          </dl>
        </div>
        <dl className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-2xl border border-border bg-surface-strong/50 p-3">
            <dt className="text-xs uppercase tracking-[0.2em] text-subtle">Recomendacoes geradas</dt>
            <dd className="mt-1 text-sm font-medium text-ink">{metrics.recommendationsGenerated}</dd>
          </div>
          <div className="rounded-2xl border border-border bg-surface-strong/50 p-3">
            <dt className="text-xs uppercase tracking-[0.2em] text-subtle">Cache hits / misses</dt>
            <dd className="mt-1 text-sm font-medium text-ink">
              {metrics.recommendationCacheHits} / {metrics.recommendationCacheMisses}
            </dd>
          </div>
          <div className="rounded-2xl border border-border bg-surface-strong/50 p-3">
            <dt className="text-xs uppercase tracking-[0.2em] text-subtle">TTL do cache</dt>
            <dd className="mt-1 text-sm font-medium text-ink">{publicConfig.recommendations.cacheTtlSeconds}s</dd>
          </div>
        </dl>
      </Card>

      <Card className="space-y-3">
        <h2 className="text-lg font-semibold text-ink">Configuracao publica</h2>
        <dl className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-2xl border border-border bg-surface-strong/50 p-3">
            <dt className="text-xs uppercase tracking-[0.2em] text-subtle">URL da aplicacao</dt>
            <dd className="mt-1 text-sm font-medium text-ink">{publicConfig.urls.appUrl}</dd>
          </div>
          <div className="rounded-2xl border border-border bg-surface-strong/50 p-3">
            <dt className="text-xs uppercase tracking-[0.2em] text-subtle">Paginacao padrao</dt>
            <dd className="mt-1 text-sm font-medium text-ink">
              {publicConfig.pagination.defaultPageSize} (max {publicConfig.pagination.maxPageSize})
            </dd>
          </div>
          <div className="rounded-2xl border border-border bg-surface-strong/50 p-3">
            <dt className="text-xs uppercase tracking-[0.2em] text-subtle">TMDb configurado</dt>
            <dd className="mt-1 text-sm font-medium text-ink">{publicConfig.tmdbConfigured ? "Sim" : "Nao"}</dd>
          </div>
          <div className="rounded-2xl border border-border bg-surface-strong/50 p-3">
            <dt className="text-xs uppercase tracking-[0.2em] text-subtle">Rate limit ativo</dt>
            <dd className="mt-1 text-sm font-medium text-ink">{publicConfig.rateLimit.enabled ? "Sim" : "Nao (preparado)"}</dd>
          </div>
        </dl>
      </Card>

      <Card padding={systemSettings.length ? "none" : "md"}>
        <h2 className="p-5 pb-0 text-lg font-semibold text-ink">System settings</h2>
        {systemSettings.length === 0 ? (
          <p className="p-5 pt-2 text-sm text-muted">Nenhuma configuracao registrada.</p>
        ) : (
          <TableContainer className="mt-3">
            <Table>
              <TableHead>
                <tr>
                  <Th>Chave</Th>
                  <Th>Valor</Th>
                  <Th>Descricao</Th>
                  <Th>Publica</Th>
                </tr>
              </TableHead>
              <TableBody>
                {systemSettings.map((setting) => (
                  <TableRow key={setting.id}>
                    <Td className="font-medium">{setting.key}</Td>
                    <Td className="text-muted">{JSON.stringify(setting.value)}</Td>
                    <Td className="text-muted">{setting.description ?? "-"}</Td>
                    <Td className="text-muted">{setting.public ? "Sim" : "Nao"}</Td>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </Card>
    </div>
  );
}
