import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";

export function Filters({ query = "" }: { query?: string }) {
  return (
    <form className="grid gap-3 rounded-4xl border border-white/10 bg-slate-950/50 p-4 sm:grid-cols-2 xl:grid-cols-6" method="get">
      <Input name="q" defaultValue={query} placeholder="Buscar serie, genero, titulo..." />
      <Select name="genre" defaultValue="">
        <option value="">Genero</option>
        <option>Sci-Fi</option>
        <option>Drama</option>
        <option>Comedy</option>
      </Select>
      <Select name="year" defaultValue="">
        <option value="">Ano</option>
        <option>2025</option>
        <option>2024</option>
        <option>2023</option>
      </Select>
      <Select name="status" defaultValue="">
        <option value="">Status</option>
        <option>Returning</option>
        <option>Ended</option>
      </Select>
      <Select name="language" defaultValue="">
        <option value="">Idioma</option>
        <option>PT-BR</option>
        <option>EN</option>
        <option>DE</option>
      </Select>
      <button className="min-h-11 rounded-2xl bg-ember px-4 text-sm font-semibold text-night" type="submit">
        Buscar
      </button>
    </form>
  );
}
