import Link from "next/link";
import { Card } from "@/components/ui/card";

type SummaryLine = {
  count: number;
  label: string;
  href: string;
};

/**
 * Fase 5 (INSERIES-DASHBOARD-OPERATIONAL-EXPERIENCE-04) — "bloco compacto ao lado do hero...
 * nao apresentar como estatisticas de vaidade... nao usar graficos... cada informacao deve
 * funcionar como link quando aplicavel". 3 numeros, cada um ja com contexto no proprio label
 * (nunca so o numero) e um link pra secao/pagina onde a acao correspondente vive - nunca
 * decorativo, sempre uma porta de entrada pro resto do Dashboard.
 */
export function OperationalSummary({ lines, ctaHref, ctaLabel }: { lines: SummaryLine[]; ctaHref: string; ctaLabel: string }) {
  return (
    <Card className="flex h-full flex-col gap-4">
      <p className="eyebrow">Agora</p>
      <ul className="flex-1 space-y-3">
        {lines.map((line) => {
          const lineClassName = "group flex items-baseline gap-2 text-sm text-muted transition hover:text-ink";
          const content = (
            <>
              <span className="text-lg font-semibold text-ink group-hover:text-primary-text">{line.count}</span>
              <span>{line.label}</span>
            </>
          );
          return (
            <li key={line.label}>
              {/* Ancoras na mesma pagina (#id) usam <a> nativa de proposito: o `Link` do
                  Next.js atualiza a URL mas nao rola ate o alvo em navegacao hash-only na
                  mesma pagina (achado ao vivo - clique atualizava o hash, scrollY ficava 0).
                  Scroll nativo do navegador so funciona com <a> real. */}
              {line.href.startsWith("#") ? (
                <a href={line.href} className={lineClassName}>
                  {content}
                </a>
              ) : (
                <Link href={line.href} className={lineClassName}>
                  {content}
                </Link>
              )}
            </li>
          );
        })}
      </ul>
      <Link href={ctaHref} className="link-accent text-sm">
        {ctaLabel}
      </Link>
    </Card>
  );
}
