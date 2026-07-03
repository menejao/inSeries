import Link from "next/link";
import { cn } from "@/lib/utils";
import { ChevronLeftIcon, ChevronRightIcon } from "@/components/ui/icons";

function buildHref(basePath: string, params: Record<string, string | undefined>, page: number) {
  const search = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value) search.set(key, value);
  });
  search.set("page", String(page));
  return `${basePath}?${search.toString()}`;
}

export function Pagination({
  page,
  totalPages,
  params,
  basePath
}: {
  page: number;
  totalPages: number;
  params: Record<string, string | undefined>;
  basePath: string;
}) {
  if (totalPages <= 1) return null;

  const prevDisabled = page <= 1;
  const nextDisabled = page >= totalPages;

  return (
    <nav aria-label="Paginacao" className="flex items-center justify-between gap-3">
      <Link
        href={buildHref(basePath, params, Math.max(1, page - 1))}
        aria-disabled={prevDisabled}
        tabIndex={prevDisabled ? -1 : undefined}
        className={cn(
          "inline-flex min-h-11 items-center gap-1.5 rounded-full border border-border bg-surface px-4 text-sm font-semibold text-ink transition hover:border-border-strong",
          prevDisabled && "pointer-events-none opacity-40"
        )}
      >
        <ChevronLeftIcon className="h-4 w-4" />
        Anterior
      </Link>
      <p className="text-sm text-muted" aria-live="polite">
        Pagina {page} de {totalPages}
      </p>
      <Link
        href={buildHref(basePath, params, Math.min(totalPages, page + 1))}
        aria-disabled={nextDisabled}
        tabIndex={nextDisabled ? -1 : undefined}
        className={cn(
          "inline-flex min-h-11 items-center gap-1.5 rounded-full border border-border bg-surface px-4 text-sm font-semibold text-ink transition hover:border-border-strong",
          nextDisabled && "pointer-events-none opacity-40"
        )}
      >
        Proxima
        <ChevronRightIcon className="h-4 w-4" />
      </Link>
    </nav>
  );
}
