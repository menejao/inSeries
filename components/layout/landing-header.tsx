import Link from "next/link";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { buttonVariants } from "@/components/ui/button";

/** Fase 2/3 — the public header. No sidebar, no app navigation links: a visitor is here to learn about the product, not use it. */
export function LandingHeader() {
  return (
    <header className="safe-pt flex items-center justify-between gap-4 py-4">
      <Link href="/" className="flex items-center gap-3">
        <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary text-lg font-black text-primary-foreground">
          in
        </span>
        <span className="hidden sm:block">
          <span className="block text-lg font-semibold leading-tight text-ink">inSeries</span>
          <span className="block text-xs text-muted">Suas series, episodio por episodio</span>
        </span>
      </Link>
      <div className="flex items-center gap-2">
        <ThemeToggle />
        <Link href="/login" className={buttonVariants({ variant: "ghost", size: "sm" })}>
          Entrar
        </Link>
        <Link href="/register" className={buttonVariants({ variant: "primary", size: "sm" })}>
          Criar conta
        </Link>
      </div>
    </header>
  );
}
