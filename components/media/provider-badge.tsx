import { getProviderColor, getProviderInitial } from "@/lib/catalog/provider-labels";
import { cn } from "@/lib/utils";

/** Fase 5 — one streaming provider, brand-colored initial + name. See lib/catalog/provider-labels.ts for why this isn't a hotlinked logo image. */
export function ProviderBadge({ provider, className }: { provider: string; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border border-border bg-surface-strong/80 py-1 pl-1 pr-2.5 text-xs font-medium text-ink backdrop-blur",
        className
      )}
    >
      <span
        aria-hidden="true"
        className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[9px] font-bold text-white"
        style={{ backgroundColor: getProviderColor(provider) }}
      >
        {getProviderInitial(provider)}
      </span>
      {provider}
    </span>
  );
}

/** Renders every provider a series is available on, or nothing if none are synced yet. Fase 7 (INSERIES-SERIES-PAGE-PREMIUM-01) — always alphabetical, so the same series shows providers in the same order everywhere ("ordem consistente"). */
export function ProviderList({ providers, limit, className }: { providers: string[]; limit?: number; className?: string }) {
  if (!providers.length) return null;
  const sorted = [...providers].sort((a, b) => a.localeCompare(b));
  const visible = limit ? sorted.slice(0, limit) : sorted;
  const hiddenCount = sorted.length - visible.length;

  return (
    <div className={className ?? "flex flex-wrap gap-1.5"}>
      {visible.map((provider) => (
        <ProviderBadge key={provider} provider={provider} />
      ))}
      {hiddenCount > 0 ? (
        <span className="inline-flex items-center rounded-full border border-border bg-surface-strong/60 px-2 py-1 text-xs text-muted">
          +{hiddenCount}
        </span>
      ) : null}
    </div>
  );
}
