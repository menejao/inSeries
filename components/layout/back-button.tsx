"use client";

import { useRouter, usePathname } from "next/navigation";
import { ChevronLeftIcon } from "@/components/ui/icons";

const HIDDEN_PATHS = new Set(["/", "/me/minha-lista", "/calendar", "/series", "/feed"]);

export function BackButton() {
  const router = useRouter();
  const pathname = usePathname();

  if (HIDDEN_PATHS.has(pathname)) return null;

  return (
    <button
      type="button"
      onClick={() => router.back()}
      aria-label="Voltar"
      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-border text-muted transition hover:border-border-strong hover:text-ink"
    >
      <ChevronLeftIcon className="h-5 w-5" />
    </button>
  );
}
