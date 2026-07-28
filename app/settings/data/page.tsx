import Link from "next/link";
import { redirect } from "next/navigation";
import { ChevronLeftIcon } from "@/components/ui/icons";
import { DataCenter } from "@/components/data/data-center";
import { getCurrentUser } from "@/lib/auth/server";

/** INSERIES-HISTORY-IMPORT-AND-DATA-PORTABILITY-01 — Configuracoes > Dados. */
export default async function DataSettingsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Link href="/settings" className="inline-flex items-center gap-1 text-sm font-medium text-muted hover:text-ink">
          <ChevronLeftIcon className="h-4 w-4" /> Configuracoes
        </Link>
        <h1 className="section-title">Dados</h1>
        <p className="section-copy">Importe historico de outros servicos, exporte seus dados ou faca manutencao.</p>
      </div>

      <DataCenter />
    </div>
  );
}
