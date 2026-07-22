/** Fase 12/17 (INSERIES-PRODUCT-EXPERIENCE-REVOLUTION-01) — extraido: existia duplicado, byte a byte, em app/series/[id]/page.tsx e production-section.tsx. */
export function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wide text-subtle">{label}</dt>
      <dd className="mt-0.5 font-medium text-ink">{value}</dd>
    </div>
  );
}
