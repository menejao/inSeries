"use client";

import { cn } from "@/lib/utils";
import { forwardRef, useId, type InputHTMLAttributes, type ReactNode } from "react";

type RadioProps = Omit<InputHTMLAttributes<HTMLInputElement>, "type"> & {
  label: ReactNode;
  description?: ReactNode;
};

export const Radio = forwardRef<HTMLInputElement, RadioProps>(function Radio(
  { label, description, className, id, ...props },
  ref
) {
  const generatedId = useId();
  const inputId = id ?? generatedId;

  return (
    <label htmlFor={inputId} className={cn("flex cursor-pointer items-start gap-3 text-sm text-ink", className)}>
      <span className="relative mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center">
        <input ref={ref} id={inputId} type="radio" className="peer sr-only" {...props} />
        <span
          aria-hidden="true"
          className="absolute inset-0 rounded-full border border-border-strong bg-surface transition peer-checked:border-primary peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-ring"
        />
        <span
          aria-hidden="true"
          className="relative z-10 h-2.5 w-2.5 scale-0 rounded-full bg-primary transition peer-checked:scale-100"
        />
      </span>
      <span>
        <span className="font-medium">{label}</span>
        {description ? <span className="mt-0.5 block text-xs text-muted">{description}</span> : null}
      </span>
    </label>
  );
});
