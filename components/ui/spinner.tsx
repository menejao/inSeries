import { cn } from "@/lib/utils";
import { LoaderIcon } from "@/components/ui/icons";

const sizeClasses = {
  sm: "h-4 w-4",
  md: "h-6 w-6",
  lg: "h-9 w-9"
};

export function Spinner({ size = "md", className, label = "Carregando" }: { size?: keyof typeof sizeClasses; className?: string; label?: string }) {
  return (
    <span role="status" className="inline-flex items-center">
      <LoaderIcon className={cn("animate-spin text-muted", sizeClasses[size], className)} />
      <span className="sr-only">{label}</span>
    </span>
  );
}
