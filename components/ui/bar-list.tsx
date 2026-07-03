export type BarListItem = {
  label: string;
  value: number;
  percentage: number;
};

/** Horizontal bar ranking — genres, top series, anything "label + share". */
export function BarList({ items, valueSuffix = "" }: { items: BarListItem[]; valueSuffix?: string }) {
  if (items.length === 0) return null;

  return (
    <ul className="space-y-3">
      {items.map((item) => (
        <li key={item.label} className="space-y-1">
          <div className="flex items-center justify-between gap-2 text-sm">
            <span className="font-medium text-ink">{item.label}</span>
            <span className="text-muted">
              {item.value}
              {valueSuffix} · {item.percentage}%
            </span>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-surface-strong">
            <div
              className="h-full rounded-full bg-primary transition-[width] duration-300 ease-out"
              style={{ width: `${Math.max(2, item.percentage)}%` }}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}
