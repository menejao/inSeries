import type { PropsWithChildren } from "react";
import { cn } from "@/lib/utils";

/**
 * Regra global de layout (INSERIES-DASHBOARD-PREMIUM-01) — toda listagem visual do sistema
 * usa uma quantidade FIXA de colunas por breakpoint (nunca `auto-fit`/`auto-fill`, nunca
 * `flex-wrap` com itens de largura variavel). Isso e o que garante, por construcao, que
 * nenhuma linha intermediaria fique incompleta: um CSS grid com N colunas fixas e itens sem
 * `col-span` sempre preenche da esquerda para a direita, de cima para baixo — a UNICA linha
 * que pode ficar com menos de N itens e a ultima (a excecao explicitamente permitida).
 * Nenhuma logica de truncar/preencher itens e necessaria para garantir isso; e uma
 * propriedade inerente ao layout, nao algo que precisa ser calculado.
 *
 * As colunas permitidas por breakpoint sao um conjunto fechado (mapeadas para classes
 * Tailwind literais) — nunca uma classe `grid-cols-${n}` construida em runtime, que o
 * scanner JIT do Tailwind nao consegue detectar em tempo de build.
 */
const MOBILE_COLS = { 1: "grid-cols-1", 2: "grid-cols-2", 3: "grid-cols-3" } as const;
const TABLET_COLS = { 2: "sm:grid-cols-2", 3: "sm:grid-cols-3", 4: "sm:grid-cols-4" } as const;
const DESKTOP_COLS = { 2: "lg:grid-cols-2", 3: "lg:grid-cols-3", 4: "lg:grid-cols-4", 5: "lg:grid-cols-5", 6: "lg:grid-cols-6" } as const;
const WIDE_COLS = { 4: "xl:grid-cols-4", 5: "xl:grid-cols-5", 6: "xl:grid-cols-6" } as const;

export type FixedGridProps = PropsWithChildren<{
  mobile?: keyof typeof MOBILE_COLS;
  tablet?: keyof typeof TABLET_COLS;
  desktop?: keyof typeof DESKTOP_COLS;
  wide?: keyof typeof WIDE_COLS;
  className?: string;
}>;

/** Fixed-column grid — see the module doc comment above for why this is the whole rule. */
export function FixedGrid({ children, mobile = 2, tablet, desktop = 4, wide, className }: FixedGridProps) {
  return (
    <div
      className={cn(
        "grid gap-4",
        MOBILE_COLS[mobile],
        tablet ? TABLET_COLS[tablet] : undefined,
        DESKTOP_COLS[desktop],
        wide ? WIDE_COLS[wide] : undefined,
        className
      )}
    >
      {children}
    </div>
  );
}
