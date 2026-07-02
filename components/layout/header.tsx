import Link from "next/link";
import { Button } from "@/components/ui/button";

export function Header() {
  return (
    <header className="mb-8">
      <div className="flex items-center justify-between gap-4">
        <Link href="/" className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-ember text-xl font-black text-night">
            in
          </div>
          <div>
            <p className="text-lg font-semibold text-ink">inSeries</p>
            <p className="text-xs text-slate-300">Acompanhe suas series, episodio por episodio.</p>
          </div>
        </Link>
        <div className="hidden items-center gap-3 md:flex">
          <Button variant="ghost">Instalar PWA</Button>
          <Button>Entrar</Button>
        </div>
      </div>
      <nav className="mt-4 flex gap-2 overflow-x-auto pb-1 md:hidden">
        <Link href="/feed" className="rounded-full bg-slate-900/60 px-4 py-2 text-xs font-semibold text-slate-200">
          Feed
        </Link>
      </nav>
    </header>
  );
}
