import { Card } from "@/components/ui/card";
import { Select } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";

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
    <Card as="form" method="get" padding="sm" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
      <input type="hidden" name="view" value="global" />
      <input type="hidden" name="range" value={range} />
      <Select name="genre" defaultValue={genre ?? ""} aria-label="Filtrar por genero">
        <option value="">Genero</option>
        <option>Sci-Fi</option>
        <option>Drama</option>
        <option>Comedy</option>
        <option>Teste</option>
      </Select>
      <Select name="language" defaultValue={language ?? ""} aria-label="Filtrar por idioma">
        <option value="">Idioma</option>
        <option>PT-BR</option>
        <option>pt-BR</option>
        <option>EN</option>
        <option>DE</option>
      </Select>
      <Select name="platform" defaultValue="" disabled title="Estrutura preparada para filtro por plataforma" aria-label="Filtrar por plataforma (em breve)">
        <option value="">Plataforma (em breve)</option>
      </Select>
      <Select name="country" defaultValue="" disabled title="Estrutura preparada para filtro por pais" aria-label="Filtrar por pais (em breve)">
        <option value="">Pais (em breve)</option>
      </Select>
      <div className="flex min-h-11 items-center rounded-2xl border border-border bg-surface px-4">
        <Checkbox name="onlyUnaired" value="1" defaultChecked={onlyUnaired} label="Apenas ineditos" />
      </div>
      {authenticated ? (
        <>
          <div className="flex min-h-11 items-center rounded-2xl border border-border bg-surface px-4">
            <Checkbox name="onlyMine" value="1" defaultChecked={onlyMine} label="Apenas minhas series" />
          </div>
          <div className="flex min-h-11 items-center rounded-2xl border border-border bg-surface px-4">
            <Checkbox name="onlyUnwatched" value="1" defaultChecked={onlyUnwatched} label="Apenas nao assistidos" />
          </div>
        </>
      ) : null}
      <Button type="submit" className="xl:col-span-6">
        Filtrar
      </Button>
    </Card>
  );
}
