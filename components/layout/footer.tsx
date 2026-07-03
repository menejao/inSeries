import Link from "next/link";

/** Public-site footer — only ever rendered by LandingShell, never inside the authenticated Dashboard (Fase 3). */
export function Footer() {
  return (
    <footer className="border-t border-border pt-8 text-sm text-muted">
      <div className="flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
        <div className="max-w-sm space-y-2">
          <div className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-primary text-sm font-black text-primary-foreground">
              in
            </span>
            <span className="font-semibold text-ink">inSeries</span>
          </div>
          <p>Uma plataforma independente para acompanhar series, episodio por episodio.</p>
        </div>
        <nav aria-label="Links do rodape" className="grid grid-cols-2 gap-x-10 gap-y-2 sm:grid-cols-3">
          <Link href="/series" className="transition hover:text-ink">
            Catalogo
          </Link>
          <Link href="/calendar" className="transition hover:text-ink">
            Calendario
          </Link>
          <Link href="/lists" className="transition hover:text-ink">
            Listas
          </Link>
          <Link href="/feed" className="transition hover:text-ink">
            Feed
          </Link>
          <Link href="/login" className="transition hover:text-ink">
            Entrar
          </Link>
          <Link href="/register" className="transition hover:text-ink">
            Criar conta
          </Link>
        </nav>
      </div>
      <p className="mt-6 text-xs text-subtle">© {new Date().getFullYear()} inSeries. Todos os direitos reservados.</p>
    </footer>
  );
}
