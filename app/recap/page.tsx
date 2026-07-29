import { notFound } from "next/navigation";
import Link from "next/link";
import { requireUser } from "@/lib/auth/server";
import { canAccessRecapWrapped, getRecapYear, isRecapPreviewMode } from "@/lib/recap/window";
import { getWrappedData } from "@/lib/recap/wrapped-service";
import { WrappedExperience } from "@/components/recap-wrapped/wrapped-experience";
import { WrappedPreviewBanner } from "@/components/recap-wrapped/wrapped-preview-banner";
import { Button } from "@/components/ui/button";
import { CompassIcon } from "@/components/ui/icons";

/**
 * INSERIES-RECAP-ENGINE-01 — "fora desse periodo... a rota deve ficar indisponivel." A regular
 * user hitting this URL outside the window gets a real 404, not a redirect or a locked-message
 * page — the route itself doesn't exist for them, same as the ticket's "nenhum usuario comum
 * deve conseguir acessa-lo."
 */
export default async function RecapWrappedPage() {
  const user = await requireUser();
  const isAdmin = user.role === "ADMIN";

  if (!canAccessRecapWrapped(isAdmin)) notFound();

  const year = getRecapYear();
  const data = await getWrappedData(user.id, year);
  const isPreview = isRecapPreviewMode(isAdmin);

  if (!data || !data.hasData) {
    return (
      <div className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-4 bg-canvas p-6 text-center text-ink">
        <CompassIcon className="h-8 w-8 text-subtle" />
        <h1 className="font-display text-2xl font-bold">Ainda sem Recap {year}</h1>
        <p className="max-w-xs text-sm text-muted">Assista alguns episodios em {year} para desbloquear sua retrospectiva.</p>
        <Link href="/series">
          <Button>Explorar catalogo</Button>
        </Link>
        {isPreview ? <WrappedPreviewBanner /> : null}
      </div>
    );
  }

  return (
    <>
      <WrappedExperience data={data} />
      {isPreview ? <WrappedPreviewBanner /> : null}
    </>
  );
}
