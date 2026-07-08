import { Card } from "@/components/ui/card";
import { ProviderList } from "@/components/media/provider-badge";
import { TvIcon } from "@/components/ui/icons";

/** Fase 7 (INSERIES-SERIES-PAGE-PREMIUM-01) — "nao renderizar secao" quando nao existe provider sincronizado. */
export function WhereToWatchCard({ providers }: { providers: string[] }) {
  if (!providers.length) return null;

  return (
    <Card className="space-y-3">
      <h2 className="flex items-center gap-2 text-lg font-semibold text-ink">
        <TvIcon className="h-5 w-5 text-subtle" />
        Onde assistir
      </h2>
      <ProviderList providers={providers} className="flex flex-wrap gap-2" />
    </Card>
  );
}
