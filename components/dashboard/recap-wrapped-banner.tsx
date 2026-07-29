import Link from "next/link";
import { SparklesIcon } from "@/components/ui/icons";
import { Button } from "@/components/ui/button";

/** INSERIES-RECAP-ENGINE-01 — "adicionar... chamada no Dashboard, botao 'Ver meu Recap'". Only ever rendered when the Recap is actually available (see dashboard-home.tsx) — disappears automatically once the window closes. */
export function RecapWrappedBanner() {
  return (
    <section className="relative overflow-hidden rounded-4xl border border-primary/30 bg-gradient-to-br from-primary/15 via-surface to-surface p-6 shadow-card sm:p-8">
      <div className="relative flex flex-col items-start gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-primary text-primary-foreground">
            <SparklesIcon className="h-5 w-5" />
          </span>
          <div>
            <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-primary-text">
              Novo
              <span className="text-subtle">· Evento anual</span>
            </p>
            <h2 className="mt-1 font-display text-xl font-bold text-ink sm:text-2xl">Seu Recap ja esta pronto.</h2>
            <p className="mt-1 text-sm text-muted">A sua jornada do ano, em uma experiencia so sua.</p>
          </div>
        </div>
        <Link href="/recap" className="shrink-0">
          <Button variant="primary" size="md">
            Ver meu Recap
          </Button>
        </Link>
      </div>
    </section>
  );
}
