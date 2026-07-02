import { cn } from "@/lib/utils";

export function Avatar({ label, src, className }: { label: string; src?: string | null; className?: string }) {
  if (src) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={src} alt={label} className={cn("h-12 w-12 rounded-2xl object-cover", className)} />;
  }

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
