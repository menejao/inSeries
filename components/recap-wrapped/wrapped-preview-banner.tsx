/** INSERIES-RECAP-ENGINE-01 — "exibir um aviso discreto" quando um admin acessa fora do periodo oficial. Discreet on purpose: a thin bar, not a modal blocking the experience. */
export function WrappedPreviewBanner() {
  return (
    <div className="fixed inset-x-0 bottom-0 z-50 flex justify-center pb-[calc(0.75rem+env(safe-area-inset-bottom))]">
      <span className="rounded-full bg-canvas/80 px-4 py-1.5 text-xs font-medium text-subtle backdrop-blur">
        Modo Preview — disponivel apenas para administradores.
      </span>
    </div>
  );
}
