import { Card } from "@/components/ui/card";

export default async function ListDetailsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  return (
    <Card className="space-y-4">
      <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Lista {id}</p>
      <h1 className="section-title">Sci-fi que bagunca cerebro</h1>
      <p className="section-copy">Placeholder pronto para ordenacao, itens, comentarios futuros e metadados sociais.</p>
    </Card>
  );
}
