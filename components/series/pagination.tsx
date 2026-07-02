import Link from "next/link";
import { cn } from "@/lib/utils";

function buildHref(params: Record<string, string | undefined>, page: number) {
  const search = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value) search.set(key, value);
  });
  search.set("page", String(page));
  return `/series?${search.toString()}`;
}

export function Pagination({
  page,
  totalPages,
  params
}: {
  page: number;
  totalPages: number;
  params: Record<string, string | undefined>;
}) {
  if (totalPages <= 1) return null;

  const prevDisabled = page <= 1;
  const nextDisabled = page >= totalPages;

  return (
    <nav className="flex items-center justify-between gap-3">
      <Link
        href={buildHref(params, Math.max(1, page - 1))}
        aria-disabled={prevDisabled}
        className={cn(
          "inline-flex min-h-11 items-center justify-center rounded-full border border-white/10 bg-slate-950/60 px-4 text-sm font-semibold text-ink",
          prevDisabled && "pointer-events-none opacity-40"
        )}
      >
        Anterior
      </Link>
      <p className="text-sm text-slate-300">
        Pagina {page} de {totalPages}
      </p>
      <Link
        href={buildHref(params, Math.min(totalPages, page + 1))}
        aria-disabled={nextDisabled}
        className={cn(
          "inline-flex min-h-11 items-center justify-center rounded-full border border-white/10 bg-slate-950/60 px-4 text-sm font-semibold text-ink",
          nextDisabled && "pointer-events-none opacity-40"
        )}
      >
        Proxima
      </Link>
    </nav>
  );
}
