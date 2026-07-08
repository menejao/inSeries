import Link from "next/link";
import { FixedGrid } from "@/components/ui/fixed-grid";
import { CompassIcon, FlameIcon, SparklesIcon, TvIcon } from "@/components/ui/icons";

const DISCOVER_LINKS = [
  { icon: SparklesIcon, label: "Mais bem avaliadas", href: "/series?sort=quality" },
  { icon: FlameIcon, label: "Em alta agora", href: "/series?sort=discovery" },
  { icon: TvIcon, label: "Lancamentos recentes", href: "/series?sort=latest" },
  { icon: CompassIcon, label: "Catalogo completo", href: "/series" }
];

/** Fase 2 (INSERIES-DASHBOARD-PREMIUM-01) — last section, pure navigation, reusing the catalog's own existing sort/filter query params (no new discovery rule). */
export function DiscoverMoreSection() {
  return (
    <section className="space-y-4">
      <div>
        <h2 className="section-title">Descobrir mais</h2>
        <p className="section-copy">Explore o catalogo por outros angulos.</p>
      </div>
      <FixedGrid mobile={2} desktop={4}>
        {DISCOVER_LINKS.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className="group flex flex-col items-start gap-3 rounded-3xl border border-border bg-surface/70 p-4 transition duration-200 ease-out hover:-translate-y-1 hover:border-border-strong hover:shadow-raised"
          >
            <span className="flex h-9 w-9 items-center justify-center rounded-2xl bg-primary/12 text-primary-text">
              <link.icon className="h-4.5 w-4.5" />
            </span>
            <p className="text-sm font-semibold text-ink">{link.label}</p>
          </Link>
        ))}
      </FixedGrid>
    </section>
  );
}
