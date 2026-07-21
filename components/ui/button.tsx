import { cn } from "@/lib/utils";
import type { ButtonHTMLAttributes, PropsWithChildren } from "react";
import { LoaderIcon } from "@/components/ui/icons";

export type ButtonVariant = "primary" | "secondary" | "outline" | "ghost" | "danger";
export type ButtonSize = "xs" | "sm" | "md" | "lg";

const variantClasses: Record<ButtonVariant, string> = {
  primary: "bg-primary text-primary-foreground hover:bg-primary-hover shadow-xs",
  secondary: "bg-surface-strong text-ink border border-border hover:border-border-strong",
  outline: "border border-border text-ink hover:border-border-strong hover:bg-surface",
  ghost: "bg-transparent text-muted hover:bg-surface hover:text-ink",
  danger: "bg-danger text-danger-foreground hover:brightness-110"
};

const sizeClasses: Record<ButtonSize, string> = {
  xs: "h-7 min-h-7 px-2.5 text-xs gap-1",
  sm: "h-9 min-h-9 px-3.5 text-sm gap-1.5",
  md: "h-11 min-h-11 px-5 text-sm gap-2",
  lg: "h-12 min-h-12 px-6 text-base gap-2"
};

export function buttonVariants({
  variant = "primary",
  size = "md",
  className
}: {
  variant?: ButtonVariant;
  size?: ButtonSize;
  className?: string;
} = {}) {
  return cn(
    "inline-flex items-center justify-center rounded-full font-semibold transition duration-150 ease-out active:scale-[0.97] disabled:pointer-events-none disabled:opacity-50",
    variantClasses[variant],
    sizeClasses[size],
    className
  );
}

type ButtonProps = PropsWithChildren<ButtonHTMLAttributes<HTMLButtonElement>> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
};

export function Button({ children, className, variant = "primary", size = "md", loading = false, disabled, ...props }: ButtonProps) {
  return (
    <button className={buttonVariants({ variant, size, className })} disabled={disabled || loading} {...props}>
      {loading ? <LoaderIcon className="h-4 w-4 animate-spin" /> : null}
      {children}
    </button>
  );
}

type IconButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  label: string;
  children: React.ReactNode;
};

const iconSizeClasses: Record<ButtonSize, string> = {
  xs: "h-7 w-7",
  sm: "h-9 w-9",
  md: "h-11 w-11",
  lg: "h-12 w-12"
};

/** Icon-only actions must always carry a visible-to-AT `label` — there is no visual text fallback. */
export function IconButton({ children, className, variant = "ghost", size = "md", label, ...props }: IconButtonProps) {
  return (
    <button
      aria-label={label}
      title={label}
      className={cn(
        "inline-flex items-center justify-center rounded-full transition duration-150 ease-out active:scale-90 disabled:pointer-events-none disabled:opacity-50",
        variantClasses[variant],
        iconSizeClasses[size],
        className
      )}
      {...props}
    >
      {children}
    </button>
  );
}
