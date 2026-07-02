import Link from "next/link";
import { SeriesCard } from "@/components/series/series-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { mockSeries } from "@/lib/catalog/mock-data";

export default function HomePage() {
  return (
    <div className="space-y-8">
      <section className="grid gap-6 lg:grid-cols-[1.3fr_0.7fr]">
        <Card className="overflow-hidden">
          <Badge>Web First · PWA Ready</Badge>
          <h1 className="mt-4 max-w-2xl text-4xl font-black leading-tight text-ink sm:text-5xl">
            Series first. Progresso real por episodio, listas sociais, perfil publico.
          </h1>
          <p className="mt-4 max-w-2xl text-base leading-7 text-slate-300">
            Fundacao pronta para catalogo massivo, experiencia mobile-first e futura sincronizacao automatica por TMDb.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Button>Explorar catalogo</Button>
            <Button variant="secondary">Ver minha area</Button>
          </div>
        </Card>
        <Card>
          <p className="text-sm uppercase tracking-[0.2em] text-slate-400">Sprint 01</p>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
            {["Rotas base", "Design system", "PWA shell", "Prisma schema", "TMDb adapter", "Jobs futuros"].map((item) => (
              <div key={item} className="rounded-3xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-slate-200">
                {item}
              </div>
            ))}
          </div>
        </Card>
      </section>

      <section className="space-y-4">
        <div className="flex items-end justify-between gap-4">
          <div>
            <h2 className="section-title">Em destaque</h2>
            <p className="section-copy">Estrutura catalogo com cards, status, filtros e paginas detalhadas.</p>
          </div>
          <Link href="/series" className="text-sm font-semibold text-amber-200">
            Ir para series
          </Link>
        </div>
        <div className="grid gap-4 lg:grid-cols-3">
          {mockSeries.map((series) => (
            <SeriesCard key={series.id} series={series} />
          ))}
        </div>
      </section>
    </div>
  );
}
