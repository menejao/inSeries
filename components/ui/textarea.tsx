import { cn } from "@/lib/utils";
import { forwardRef, type TextareaHTMLAttributes } from "react";

type TextareaProps = TextareaHTMLAttributes<HTMLTextAreaElement> & {
  invalid?: boolean;
};

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea(
  { className, invalid, ...props },
  ref
) {
  return (
    <textarea
      ref={ref}
      aria-invalid={invalid || undefined}
      className={cn(
        "min-h-28 w-full rounded-2xl border border-border bg-surface px-4 py-3 text-sm text-ink transition placeholder:text-subtle",
        "focus-visible:border-primary",
        invalid && "border-danger/60 focus-visible:border-danger",
        className
      )}
      {...props}
    />
  );
});
