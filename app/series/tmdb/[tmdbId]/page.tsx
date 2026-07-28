import { redirect } from "next/navigation";
import Link from "next/link";
import { ensureSeriesExists } from "@/lib/catalog/repository";
import { EmptyState } from "@/components/ui/empty-state";
import { AlertCircleIcon } from "@/components/ui/icons";
import { buttonVariants } from "@/components/ui/button";

/**
 * Fase 8/9/11/12 (INSERIES-CATALOG-TRANSPARENT-SEARCH-AND-SILENT-IMPORT-01) — URL temporaria
 * que `SeriesCard` usa (via `series.slug = "tmdb/<id>"`) pra series encontradas so no TMDb.
 * Resolve/cria o registro local silenciosamente (`ensureSeriesExists`, idempotente) e
 * redireciona pra URL canonica definitiva (`/series/:slug`) — o usuario nunca ve esta rota
 * como destino final, so como um passo de resolucao (loading.tsx mostra o feedback "Abrindo...").
 * Nao ha modal, confirmacao ou tela intermediaria: e uma unica navegacao com um redirect no meio.
 */
export default async function ResolveTmdbSeriesPage({ params }: { params: Promise<{ tmdbId: string }> }) {
  const { tmdbId } = await params;

  let series: { slug: string } | null = null;
  try {
    series = await ensureSeriesExists(tmdbId);
  } catch {
    // Fase 18 — erro generico, sem termos tecnicos (TMDb/curadoria/persistencia/conflito).
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <EmptyState
          icon={<AlertCircleIcon className="h-6 w-6" />}
          title="Nao foi possivel abrir esta serie agora."
          copy=""
          action={
            <div className="flex flex-wrap items-center justify-center gap-2">
              <Link href={`/series/tmdb/${tmdbId}`} className={buttonVariants({ variant: "primary", size: "sm" })}>
                Tentar novamente
              </Link>
              <Link href="/series" className={buttonVariants({ variant: "secondary", size: "sm" })}>
                Voltar ao catalogo
              </Link>
            </div>
          }
        />
      </div>
    );
  }

  redirect(`/series/${series.slug}`);
}
