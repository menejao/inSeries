import { cn } from "@/lib/utils";

const sizeClasses = {
  sm: "h-9 w-9 text-xs",
  md: "h-12 w-12 text-sm",
  lg: "h-16 w-16 text-base",
  xl: "h-24 w-24 text-2xl"
};

export function Avatar({
  label,
  name,
  src,
  size = "md",
  className
}: {
  /** Initials shown when there's no photo. */
  label: string;
  /** Full name used as the image's accessible name; falls back to `label`. */
  name?: string;
  src?: string | null;
  size?: keyof typeof sizeClasses;
  className?: string;
}) {
  if (src) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={src} alt={name ?? label} className={cn("shrink-0 rounded-2xl object-cover", sizeClasses[size], className)} />;
  }

  return (
    <div
      className={cn(
        "flex shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-primary to-warning font-bold text-primary-foreground",
        sizeClasses[size],
        className
      )}
      aria-hidden="true"
    >
      {label}
    </div>
  );
}
