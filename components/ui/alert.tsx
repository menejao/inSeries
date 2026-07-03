import type { PropsWithChildren, ReactNode } from "react";
import { cn } from "@/lib/utils";
import { AlertCircleIcon, CheckCircleIcon, InfoIcon } from "@/components/ui/icons";

export type AlertVariant = "info" | "success" | "warning" | "danger";

const variantClasses: Record<AlertVariant, string> = {
  info: "border-secondary/25 bg-secondary/10 text-secondary-text",
  success: "border-success/25 bg-success/10 text-success-text",
  warning: "border-warning/25 bg-warning/10 text-warning-text",
  danger: "border-danger/25 bg-danger/10 text-danger-text"
};

const variantIcons: Record<AlertVariant, ReactNode> = {
  info: <InfoIcon className="h-5 w-5" />,
  success: <CheckCircleIcon className="h-5 w-5" />,
  warning: <AlertCircleIcon className="h-5 w-5" />,
  danger: <AlertCircleIcon className="h-5 w-5" />
};

type AlertProps = PropsWithChildren<{
  variant?: AlertVariant;
  title?: string;
  className?: string;
  icon?: ReactNode;
}>;

export function Alert({ children, variant = "info", title, className, icon }: AlertProps) {
  return (
    <div role={variant === "danger" ? "alert" : "status"} className={cn("flex items-start gap-3 rounded-3xl border p-4 text-sm leading-6 animate-fade-in", variantClasses[variant], className)}>
      <span className="mt-0.5 shrink-0">{icon ?? variantIcons[variant]}</span>
      <div className="text-ink/90">
        {title ? <p className="font-semibold text-ink">{title}</p> : null}
        <div>{children}</div>
      </div>
    </div>
  );
}
