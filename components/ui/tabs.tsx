import Link from "next/link";
import { cn } from "@/lib/utils";

export function Tabs({ items, active }: { items: Array<{ href: string; label: string }>; active: string }) {
  return (
    <div className="flex gap-2 overflow-x-auto pb-1">
      {items.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          className={cn(
            "rounded-full px-4 py-2 text-sm transition",
            item.href === active ? "bg-ember text-night" : "bg-slate-900/60 text-slate-300"
          )}
        >
          {item.label}
        </Link>
      ))}
    </div>
  );
}
