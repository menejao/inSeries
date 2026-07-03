"use client";

import { cn } from "@/lib/utils";
import { forwardRef, useId, type InputHTMLAttributes, type ReactNode } from "react";
import { CheckIcon } from "@/components/ui/icons";

type CheckboxProps = Omit<InputHTMLAttributes<HTMLInputElement>, "type"> & {
  label: ReactNode;
  description?: ReactNode;
};

export const Checkbox = forwardRef<HTMLInputElement, CheckboxProps>(function Checkbox(
  { label, description, className, id, ...props },
  ref
) {
  const generatedId = useId();
  const inputId = id ?? generatedId;

  return (
    <label htmlFor={inputId} className={cn("flex cursor-pointer items-start gap-3 text-sm text-ink", className)}>
      <span className="relative mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center">
        <input ref={ref} id={inputId} type="checkbox" className="peer sr-only" {...props} />
        <span
          aria-hidden="true"
          className="absolute inset-0 rounded-md border border-border-strong bg-surface transition peer-checked:border-primary peer-checked:bg-primary peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-ring"
        />
        <CheckIcon
          aria-hidden="true"
          className="relative z-10 h-3.5 w-3.5 text-primary-foreground opacity-0 transition peer-checked:opacity-100"
        />
      </span>
      <span>
        <span className="font-medium">{label}</span>
        {description ? <span className="mt-0.5 block text-xs text-muted">{description}</span> : null}
      </span>
    </label>
  );
});
