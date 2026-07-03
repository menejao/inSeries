import Link from "next/link";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Button } from "@/components/ui/button";
import { MeTabs } from "@/components/me/me-tabs";
import { RecapUnavailable } from "@/components/recap/recap-unavailable";
import { CompassIcon, SparklesIcon } from "@/components/ui/icons";
import { requireUser } from "@/lib/auth/server";
import { listAvailableRecaps } from "@/lib/recap";

export default async function RecapIndexPage() {
  const user = await requireUser();
  const result = await listAvailableRecaps(user.id);

  return (
    <div className="space-y-6">
      <div>
        <p className="eyebrow">Minha area</p>
        <h1 className="section-title">Recap</h1>
        <p className="section-copy">Retrospectivas mensais e anuais geradas a partir do seu historico real de series.</p>
      </div>
      <MeTabs active="/me/recap" />

      {!result.enabled ? (
        <RecapUnavailable />
      ) : result.availability.years.length === 0 && result.availability.months.length === 0 ? (
        <EmptyState
          icon={<CompassIcon className="h-6 w-6" />}
          title="Ainda sem recap"
          copy="Marque episodios como assistidos para gerar seu primeiro recap."
          action={
            <Link href="/series">
              <Button>Explorar catalogo</Button>
            </Link>
          }
        />
      ) : (
        <>
          {result.availability.years.length ? (
            <section className="space-y-3">
              <h2 className="flex items-center gap-2 text-xl font-semibold text-ink">
                <SparklesIcon className="h-5 w-5 text-subtle" />
                Recaps anuais
              </h2>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {result.availability.years.map((period) => (
                  <Link key={period.year} href={`/me/recap/${period.year}`}>
                    <Card interactive padding="sm">
                      <p className="font-semibold capitalize text-ink">{period.label}</p>
                      <p className="text-sm text-muted">{period.episodesWatched} episodio(s) assistidos</p>
                    </Card>
                  </Link>
                ))}
              </div>
            </section>
          ) : null}

          {result.availability.months.length ? (
            <section className="space-y-3">
              <h2 className="text-xl font-semibold text-ink">Recaps mensais</h2>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {result.availability.months.map((period) => (
                  <Link key={`${period.year}-${period.month}`} href={`/me/recap/${period.year}/${period.month}`}>
                    <Card interactive padding="sm">
                      <p className="font-semibold capitalize text-ink">{period.label}</p>
                      <p className="text-sm text-muted">{period.episodesWatched} episodio(s) assistidos</p>
                    </Card>
                  </Link>
                ))}
              </div>
            </section>
          ) : null}
        </>
      )}
    </div>
  );
}
