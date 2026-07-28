import { Skeleton, SkeletonText } from "@/components/ui/skeleton";

/**
 * Fase 16 — feedback permitido enquanto `ensureSeriesExists` resolve: skeleton no formato da
 * pagina de destino (mesmo de app/series/[id]/loading.tsx), sem layout shift, sem texto tecnico
 * como "Importando"/"Sincronizando". "Abrindo..." teria menos contexto visual que reaproveitar
 * o proprio skeleton da pagina de series (o usuario ja reconhece esse formato).
 */
export default function ResolveTmdbSeriesLoading() {
  return (
    <div className="space-y-6">
      <p className="sr-only" role="status">
        Abrindo...
      </p>
      <div className="space-y-4">
        <Skeleton className="aspect-[16/7] w-full rounded-4xl" />
        <div className="flex gap-4 px-2">
          <Skeleton className="hidden h-48 w-32 shrink-0 rounded-3xl sm:block" />
          <div className="flex-1 space-y-3 pt-2">
            <Skeleton className="h-8 w-2/3 rounded-full" />
            <SkeletonText lines={2} />
          </div>
        </div>
      </div>
      <Skeleton className="h-24 rounded-4xl" />
    </div>
  );
}
