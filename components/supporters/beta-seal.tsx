import { Badge } from "@/components/ui/badge";

/** INSERIES-SUPPORTER-SYSTEM-01 — "recursos em teste poderao possuir um selo indicando que fazem parte do programa Beta". Drop next to any in-development feature's label; no gating logic here, just the visual seal. */
export function BetaSeal({ className }: { className?: string }) {
  return (
    <Badge variant="secondary" className={className}>
      🧪 Beta
    </Badge>
  );
}
