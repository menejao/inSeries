import { cn } from "@/lib/utils";

/** INSERIES-SUPPORTER-SYSTEM-01 — "❤️ Apoiador" badge. Renders in profile/reviews/comments/lists wherever the author is passed through; caller decides visibility via `isSupporter && showSupporterBadge`. */
export function SupporterBadge({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border border-danger/25 bg-danger/10 px-2 py-0.5 text-[11px] font-semibold text-danger-text",
        className
      )}
    >
      <span aria-hidden="true">❤️</span>
      Apoiador
    </span>
  );
}
