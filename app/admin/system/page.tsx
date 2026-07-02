import { readdirSync } from "node:fs";
import { join } from "node:path";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { requireAdminUser } from "@/lib/admin/rbac";
import { canUseDatabase } from "@/lib/db/health";
import packageJson from "@/package.json";
import prismaClientPackageJson from "@prisma/client/package.json";

function getSanitizedDatabaseTarget() {
  const raw = process.env.DATABASE_URL;
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

  const dbOnline = await canUseDatabase();
  const migrationCount = countMigrations();

  const infoRows: { label: string; value: string }[] = [
    { label: "Versao da aplicacao", value: packageJson.version },
    { label: "Ambiente", value: process.env.NODE_ENV ?? "desconhecido" },
    { label: "Versao do Prisma", value: prismaClientPackageJson.version },
    { label: "Banco de dados", value: getSanitizedDatabaseTarget() },
    { label: "Migrations aplicadas", value: String(migrationCount) },
    { label: "Versao do Node", value: process.version }
  ];

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Admin</p>
        <h1 className="section-title">Sistema</h1>
      </div>

      <Card className="space-y-3">
        <div className="flex items-center gap-2">
          <span className="text-sm text-slate-300">Status do banco:</span>
          <Badge>{dbOnline ? "Online" : "Indisponivel"}</Badge>
        </div>
        <dl className="grid gap-3 sm:grid-cols-2">
          {infoRows.map((row) => (
            <div key={row.label} className="rounded-2xl border border-white/5 bg-slate-900/40 p-3">
              <dt className="text-xs uppercase tracking-[0.2em] text-slate-400">{row.label}</dt>
              <dd className="mt-1 text-sm font-medium text-ink">{row.value}</dd>
            </div>
          ))}
        </dl>
      </Card>
    </div>
  );
}
