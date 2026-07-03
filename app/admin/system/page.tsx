import { readdirSync } from "node:fs";
import { join } from "node:path";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { requireAdminUser } from "@/lib/admin/rbac";
import { canUseDatabase } from "@/lib/db/health";
import { config, getPublicConfig } from "@/lib/config";
import { getAllFeatureFlags } from "@/lib/config/flags";
import { getHealthSnapshot, getReadySnapshot } from "@/lib/health/service";
import { getMetricsSnapshot } from "@/lib/metrics/service";
import { listSystemSettings } from "@/lib/system-settings/service";
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
      <div>
        <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Admin</p>
        <h1 className="section-title">Sistema</h1>
      </div>

      <Card className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm text-slate-300">Status do banco:</span>
          <Badge>{dbOnline ? "Online" : "Indisponivel"}</Badge>
          <span className="text-sm text-slate-300">Health:</span>
          <Badge>{health.status}</Badge>
          <span className="text-sm text-slate-300">Ready:</span>
          <Badge>{ready.status}</Badge>
        </div>
        <p className="text-xs text-slate-400">
          Ready checks: configuracao={String(ready.checks.configuration)}, banco={String(ready.checks.database)}
        </p>
        <dl className="grid gap-3 sm:grid-cols-2">
          {infoRows.map((row) => (
            <div key={row.label} className="rounded-2xl border border-white/5 bg-slate-900/40 p-3">
              <dt className="text-xs uppercase tracking-[0.2em] text-slate-400">{row.label}</dt>
              <dd className="mt-1 text-sm font-medium text-ink">{row.value}</dd>
            </div>
          ))}
        </dl>
      </Card>

      <Card className="space-y-3">
        <h2 className="text-lg font-semibold text-ink">Feature flags</h2>
        <div className="flex flex-wrap gap-2">
          {Object.entries(featureFlags).map(([flag, enabled]) => (
            <Badge key={flag} className={enabled ? undefined : "opacity-50"}>
              {flag}: {enabled ? "on" : "off"}
            </Badge>
          ))}
        </div>
      </Card>

      <Card className="space-y-3">
        <h2 className="text-lg font-semibold text-ink">Metricas basicas</h2>
        <p className="text-xs text-slate-400">Em memoria desde {new Date(metrics.startedAt).toLocaleString("pt-BR")}. Reinicia a cada deploy/restart.</p>
        <dl className="grid gap-3 sm:grid-cols-3">
          {metricRows.map((row) => (
            <div key={row.label} className="rounded-2xl border border-white/5 bg-slate-900/40 p-3">
              <dt className="text-xs uppercase tracking-[0.2em] text-slate-400">{row.label}</dt>
              <dd className="mt-1 text-sm font-medium text-ink">{row.value}</dd>
            </div>
          ))}
        </dl>
      </Card>

      <Card className="space-y-3">
        <h2 className="text-lg font-semibold text-ink">Configuracao publica</h2>
        <dl className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-2xl border border-white/5 bg-slate-900/40 p-3">
            <dt className="text-xs uppercase tracking-[0.2em] text-slate-400">URL da aplicacao</dt>
            <dd className="mt-1 text-sm font-medium text-ink">{publicConfig.urls.appUrl}</dd>
          </div>
          <div className="rounded-2xl border border-white/5 bg-slate-900/40 p-3">
            <dt className="text-xs uppercase tracking-[0.2em] text-slate-400">Paginacao padrao</dt>
            <dd className="mt-1 text-sm font-medium text-ink">
              {publicConfig.pagination.defaultPageSize} (max {publicConfig.pagination.maxPageSize})
            </dd>
          </div>
          <div className="rounded-2xl border border-white/5 bg-slate-900/40 p-3">
            <dt className="text-xs uppercase tracking-[0.2em] text-slate-400">TMDb configurado</dt>
            <dd className="mt-1 text-sm font-medium text-ink">{publicConfig.tmdbConfigured ? "Sim" : "Nao"}</dd>
          </div>
          <div className="rounded-2xl border border-white/5 bg-slate-900/40 p-3">
            <dt className="text-xs uppercase tracking-[0.2em] text-slate-400">Rate limit ativo</dt>
            <dd className="mt-1 text-sm font-medium text-ink">{publicConfig.rateLimit.enabled ? "Sim" : "Nao (preparado)"}</dd>
          </div>
        </dl>
      </Card>

      <Card>
        <h2 className="text-lg font-semibold text-ink">System settings</h2>
        {systemSettings.length === 0 ? (
          <p className="mt-2 text-sm text-slate-300">Nenhuma configuracao registrada.</p>
        ) : (
          <table className="mt-3 w-full text-left text-sm">
            <thead className="text-xs uppercase tracking-wide text-slate-400">
              <tr>
                <th className="px-3 py-2">Chave</th>
                <th className="px-3 py-2">Valor</th>
                <th className="px-3 py-2">Descricao</th>
                <th className="px-3 py-2">Publica</th>
              </tr>
            </thead>
            <tbody>
              {systemSettings.map((setting) => (
                <tr key={setting.id} className="border-t border-white/5">
                  <td className="px-3 py-2 font-medium text-ink">{setting.key}</td>
                  <td className="px-3 py-2 text-slate-300">{JSON.stringify(setting.value)}</td>
                  <td className="px-3 py-2 text-slate-300">{setting.description ?? "-"}</td>
                  <td className="px-3 py-2 text-slate-300">{setting.public ? "Sim" : "Nao"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  );
}
