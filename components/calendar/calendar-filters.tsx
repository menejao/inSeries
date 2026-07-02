import { Select } from "@/components/ui/select";

export function CalendarFilters({
  range,
  genre,
  language,
  onlyMine,
  onlyUnwatched,
  onlyUnaired,
  authenticated
}: {
  range: string;
  genre?: string;
  language?: string;
  onlyMine?: boolean;
  onlyUnwatched?: boolean;
  onlyUnaired?: boolean;
  authenticated: boolean;
}) {
  return (
    <form className="grid gap-3 rounded-4xl border border-white/10 bg-slate-950/50 p-4 sm:grid-cols-2 xl:grid-cols-6" method="get">
      <input type="hidden" name="view" value="global" />
      <input type="hidden" name="range" value={range} />
      <Select name="genre" defaultValue={genre ?? ""}>
        <option value="">Genero</option>
        <option>Sci-Fi</option>
        <option>Drama</option>
        <option>Comedy</option>
        <option>Teste</option>
      </Select>
      <Select name="language" defaultValue={language ?? ""}>
        <option value="">Idioma</option>
        <option>PT-BR</option>
        <option>pt-BR</option>
        <option>EN</option>
        <option>DE</option>
      </Select>
      <Select name="platform" defaultValue="" disabled title="Estrutura preparada para filtro por plataforma">
        <option value="">Plataforma (em breve)</option>
      </Select>
      <Select name="country" defaultValue="" disabled title="Estrutura preparada para filtro por pais">
        <option value="">Pais (em breve)</option>
      </Select>
      <label className="flex min-h-11 items-center gap-2 rounded-2xl border border-white/10 bg-slate-950/60 px-4 text-sm text-slate-200">
        <input type="checkbox" name="onlyUnaired" value="1" defaultChecked={onlyUnaired} />
        Apenas ineditos
      </label>
      {authenticated ? (
        <>
          <label className="flex min-h-11 items-center gap-2 rounded-2xl border border-white/10 bg-slate-950/60 px-4 text-sm text-slate-200">
            <input type="checkbox" name="onlyMine" value="1" defaultChecked={onlyMine} />
            Apenas minhas series
          </label>
          <label className="flex min-h-11 items-center gap-2 rounded-2xl border border-white/10 bg-slate-950/60 px-4 text-sm text-slate-200">
            <input type="checkbox" name="onlyUnwatched" value="1" defaultChecked={onlyUnwatched} />
            Apenas nao assistidos
          </label>
        </>
      ) : null}
      <button className="min-h-11 rounded-2xl bg-ember px-4 text-sm font-semibold text-night" type="submit">
        Filtrar
      </button>
    </form>
  );
}
