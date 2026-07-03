export type DonutTone = "primary" | "secondary" | "success" | "warning" | "danger";

export type DonutSegment = {
  label: string;
  value: number;
  tone: DonutTone;
};

// Written out fully (not composed via string interpolation) so Tailwind's
// static scanner can see every class and include it in the build.
const TONE_CLASSES: Record<DonutTone, { stroke: string; dot: string }> = {
  primary: { stroke: "stroke-primary", dot: "bg-primary" },
  secondary: { stroke: "stroke-secondary", dot: "bg-secondary" },
  success: { stroke: "stroke-success", dot: "bg-success" },
  warning: { stroke: "stroke-warning", dot: "bg-warning" },
  danger: { stroke: "stroke-danger", dot: "bg-danger" }
};

/** Simple SVG donut (stacked stroke segments) — e.g. series by status. */
export function DonutChart({ segments, size = 120 }: { segments: DonutSegment[]; size?: number }) {
  const total = segments.reduce((sum, segment) => sum + segment.value, 0);
  const radius = 15.9155;
  const circumference = 2 * Math.PI * radius;

  let offset = 0;

  return (
    <div className="flex items-center gap-5">
      <svg viewBox="0 0 36 36" width={size} height={size} role="img" aria-label="Distribuicao">
        <circle cx="18" cy="18" r={radius} fill="none" className="stroke-surface-strong" strokeWidth="3.5" />
        {total > 0
          ? segments.map((segment) => {
              const fraction = segment.value / total;
              const dash = fraction * circumference;
              const circle = (
                <circle
                  key={segment.label}
                  cx="18"
                  cy="18"
                  r={radius}
                  fill="none"
                  strokeWidth="3.5"
                  strokeDasharray={`${dash} ${circumference - dash}`}
                  strokeDashoffset={-offset}
                  transform="rotate(-90 18 18)"
                  strokeLinecap="butt"
                  className={TONE_CLASSES[segment.tone].stroke}
                />
              );
              offset += dash;
              return circle;
            })
          : null}
      </svg>
      <ul className="space-y-1.5 text-sm">
        {segments.map((segment) => (
          <li key={segment.label} className="flex items-center gap-2">
            <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${TONE_CLASSES[segment.tone].dot}`} aria-hidden="true" />
            <span className="text-muted">{segment.label}</span>
            <span className="font-medium text-ink">{segment.value}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
