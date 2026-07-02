import type { ReactNode } from "react";
import { EmptyState } from "@/components/ui/empty-state";

export function CalendarSection<T>({
  title,
  items,
  renderItem,
  emptyTitle,
  emptyCopy,
  layout = "list"
}: {
  title: string;
  items: T[];
  renderItem: (item: T, index: number) => ReactNode;
  emptyTitle: string;
  emptyCopy: string;
  layout?: "list" | "grid";
}) {
  return (
    <section className="space-y-3">
      <h2 className="text-xl font-semibold text-ink">{title}</h2>
      {items.length ? (
        <div className={layout === "grid" ? "grid gap-3 md:grid-cols-2" : "space-y-3"}>
          {items.map((item, index) => renderItem(item, index))}
        </div>
      ) : (
        <EmptyState title={emptyTitle} copy={emptyCopy} />
      )}
    </section>
  );
}
