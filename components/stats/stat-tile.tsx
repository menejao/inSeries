import { Card } from "@/components/ui/card";

export function StatTile({ label, value, hint }: { label: string; value: string | number; hint?: string }) {
  return (
    <Card padding="sm">
      <p className="eyebrow">{label}</p>
      <p className="mt-2 text-2xl font-semibold text-ink">{value}</p>
      {hint ? <p className="mt-1 text-xs text-subtle">{hint}</p> : null}
    </Card>
  );
}
