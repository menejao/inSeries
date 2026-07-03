import { cn } from "@/lib/utils";
import { SearchIcon } from "@/components/ui/icons";
import type { InputHTMLAttributes } from "react";

type SearchBarProps = InputHTMLAttributes<HTMLInputElement> & {
  label: string;
};

/** A labeled search input — `label` is visually hidden but always present for screen readers. */
export function SearchBar({ label, className, id, ...props }: SearchBarProps) {
  const inputId = id ?? "search";
  return (
    <div className="relative">
      <label htmlFor={inputId} className="sr-only">
        {label}
      </label>
      <SearchIcon className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-subtle" />
      <input
        id={inputId}
        type="search"
        className={cn(
          "min-h-11 w-full rounded-2xl border border-border bg-surface pl-11 pr-4 text-sm text-ink transition placeholder:text-subtle",
          "focus-visible:border-primary",
          className
        )}
        {...props}
      />
    </div>
  );
}
