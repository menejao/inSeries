import { cn } from "@/lib/utils";

export function Avatar({ label, className }: { label: string; className?: string }) {
  return (
    <div
      className={cn(
        "flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-ember to-amber-300 text-sm font-bold text-night",
        className
      )}
    >
      {label}
    </div>
  );
}
