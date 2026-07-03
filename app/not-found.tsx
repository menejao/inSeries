import Link from "next/link";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CompassIcon } from "@/components/ui/icons";

export default function NotFound() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <Card className="flex max-w-md flex-col items-center gap-4 text-center animate-fade-in-up">
        <span className="flex h-14 w-14 items-center justify-center rounded-full bg-surface-strong text-subtle">
          <CompassIcon className="h-7 w-7" />
        </span>
        <div>
          <p className="text-3xl font-black text-ink">404</p>
          <p className="mt-1 text-lg font-semibold text-ink">Pagina nao encontrada</p>
          <p className="mt-2 text-sm text-muted">A pagina que voce procura nao existe ou foi movida.</p>
        </div>
        <Link href="/">
          <Button>Voltar para o inicio</Button>
        </Link>
      </Card>
    </div>
  );
}
