"use client";

import { cn } from "@/lib/utils";
import { forwardRef, useId, type InputHTMLAttributes, type ReactNode } from "react";

type SwitchProps = Omit<InputHTMLAttributes<HTMLInputElement>, "type"> & {
  label: ReactNode;
  description?: ReactNode;
};

export const Switch = forwardRef<HTMLInputElement, SwitchProps>(function Switch(
  { label, description, className, id, ...props },
  ref
) {
  const generatedId = useId();
  const inputId = id ?? generatedId;

  return (
    <label htmlFor={inputId} className={cn("flex cursor-pointer items-start justify-between gap-3 text-sm text-ink", className)}>
      <span>
        <span className="font-medium">{label}</span>
        {description ? <span className="mt-0.5 block text-xs text-muted">{description}</span> : null}
      </span>
      <span className="relative mt-0.5 inline-flex h-6 w-11 shrink-0 items-center">
        <input ref={ref} id={inputId} type="checkbox" className="peer sr-only" {...props} />
        <span
          aria-hidden="true"
          className="absolute inset-0 rounded-full bg-border-strong transition peer-checked:bg-primary peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-ring"
        />
        <span
          aria-hidden="true"
          className="relative z-10 h-5 w-5 translate-x-0.5 rounded-full bg-white shadow-xs transition peer-checked:translate-x-[22px]"
        />
      </span>
    </label>
  );
});
