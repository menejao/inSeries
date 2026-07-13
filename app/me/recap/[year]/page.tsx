import { notFound } from "next/navigation";
import { RecapCard } from "@/components/recap/recap-card";
import { RecapUnavailable } from "@/components/recap/recap-unavailable";
import { EmptyState } from "@/components/ui/empty-state";
import { CompassIcon } from "@/components/ui/icons";
import { requireUser } from "@/lib/auth/server";
import { getYearlyRecap } from "@/lib/recap";

export default async function YearlyRecapPage({ params }: { params: Promise<{ year: string }> }) {
  const user = await requireUser();
  const { year } = await params;
  const result = await getYearlyRecap(user.id, Number(year));

  return (
    <div className="space-y-6">
      <div>
        <p className="eyebrow">Minha area</p>
        <h1 className="section-title">Recap</h1>
      </div>

      {!result.enabled ? (
        <RecapUnavailable />
      ) : !result.ok ? (
        result.error === "invalid_year" ? (
          notFound()
        ) : (
          <EmptyState icon={<CompassIcon className="h-6 w-6" />} title="Periodo invalido" copy="Este recap ainda nao pode ser gerado (periodo futuro)." />
        )
      ) : (
        <RecapCard recap={result.data} />
      )}
    </div>
  );
}
