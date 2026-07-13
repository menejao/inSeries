import Link from "next/link";
import { FixedGrid } from "@/components/ui/fixed-grid";
import { ChartIcon, ListIcon, PlayIcon, SparklesIcon, TrophyIcon } from "@/components/ui/icons";

const SHORTCUTS = [
  { icon: PlayIcon, label: "Assistir a seguir", href: "/watch-next" },
  { icon: ListIcon, label: "Minha Lista", href: "/me/minha-lista" },
  { icon: ChartIcon, label: "Estatisticas", href: "/me/stats" },
  { icon: SparklesIcon, label: "Recap", href: "/me/recap" },
  { icon: TrophyIcon, label: "Conquistas", href: "/me/achievements" }
];

/**
 * Fase 2 (INSERIES-DASHBOARD-UX-AND-NAVIGATION-01) — substitui a antiga "Descobrir mais"
 * (links de navegacao pelo catalogo, ja acessivel via Sidebar "Catalogo"/`/series?sort=...`)
 * e os 4 cards de preview que o Dashboard mostrava para Watch Next/Minha Lista/Estatisticas/
 * Recap/Conquistas/Notificacoes: em vez de repetir o CONTEUDO dessas paginas aqui (a causa
 * raiz da auditoria da Fase 1), o Dashboard agora so oferece um atalho de um clique para
 * cada uma. Nenhuma consulta nova — sao apenas links.
 */
export function QuickShortcutsSection() {
  return (
    <section className="space-y-4">
      <div>
        <h2 className="section-title">Atalhos rapidos</h2>
        <p className="section-copy">Acesso direto ao que voce usa com mais frequencia.</p>
      </div>
      <FixedGrid mobile={2} tablet={3} desktop={5}>
        {SHORTCUTS.map((shortcut) => (
          <Link
            key={shortcut.href}
            href={shortcut.href}
            className="group flex flex-col items-start gap-3 rounded-3xl border border-border bg-surface/70 p-4 transition duration-200 ease-out hover:-translate-y-1 hover:border-border-strong hover:shadow-raised"
          >
            <span className="flex h-9 w-9 items-center justify-center rounded-2xl bg-primary/12 text-primary-text">
              <shortcut.icon className="h-4.5 w-4.5" />
            </span>
            <p className="text-sm font-semibold text-ink">{shortcut.label}</p>
          </Link>
        ))}
      </FixedGrid>
    </section>
  );
}
