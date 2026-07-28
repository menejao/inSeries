"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { SearchBar } from "@/components/ui/search-bar";

/** Debounce padrao de busca social (Fase 10/11/16), URL-driven como o resto do app. */
export function SocialSearchBar({ placeholder, label }: { placeholder: string; label: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [value, setValue] = useState(searchParams.get("q") ?? "");
  const [, startTransition] = useTransition();
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setValue(searchParams.get("q") ?? "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  function handleChange(next: string) {
    setValue(next);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      const params = new URLSearchParams(searchParams.toString());
      if (next) params.set("q", next);
      else params.delete("q");
      startTransition(() => router.push(`${pathname}?${params.toString()}`));
    }, 350);
  }

  return (
    <SearchBar
      name="q"
      label={label}
      value={value}
      onChange={(event) => handleChange(event.target.value)}
      placeholder={placeholder}
    />
  );
}
