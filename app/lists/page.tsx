import Link from "next/link";
import { Card } from "@/components/ui/card";

export default function ListsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="section-title">Listas</h1>
        <p className="section-copy">Estrutura titulo, descricao, visibilidade e ordenacao pronta.</p>
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        {[
          ["Sci-fi que bagunca cerebro", "Publica", 14],
          ["Comedias curtas para madrugada", "Followers", 9]
        ].map(([title, visibility, count], index) => (
          <Card key={String(title)}>
            <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Lista {index + 1}</p>
            <p className="mt-2 text-xl font-semibold text-ink">{title}</p>
            <p className="mt-1 text-sm text-slate-300">Visibilidade: {visibility}</p>
            <p className="mt-1 text-sm text-slate-300">{count} series</p>
            <Link href={`/lists/${index + 1}`} className="mt-4 inline-block text-sm font-semibold text-amber-200">
              Abrir lista
            </Link>
          </Card>
        ))}
      </div>
    </div>
  );
}
