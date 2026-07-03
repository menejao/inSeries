import { cn } from "@/lib/utils";
import { forwardRef, type InputHTMLAttributes } from "react";

type InputProps = InputHTMLAttributes<HTMLInputElement> & {
  invalid?: boolean;
};

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input({ className, invalid, ...props }, ref) {
  return (
    <input
      ref={ref}
      aria-invalid={invalid || undefined}
      className={cn(
        "min-h-11 w-full rounded-2xl border border-border bg-surface px-4 text-sm text-ink transition placeholder:text-subtle",
        "focus-visible:border-primary",
        invalid && "border-danger/60 focus-visible:border-danger",
        className
      )}
      {...props}
    />
  );
});
