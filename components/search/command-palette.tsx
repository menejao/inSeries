"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Dialog } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Spinner } from "@/components/ui/spinner";
import { PosterImage } from "@/components/media/poster-image";
import { Avatar } from "@/components/ui/avatar";
import {
  SearchIcon,
  CalendarIcon,
  FilmIcon,
  ListIcon,
  SettingsIcon,
  CompassIcon,
  AlertCircleIcon,
  StarIcon
} from "@/components/ui/icons";
import { cn, getInitials } from "@/lib/utils";
import type { Series } from "@/lib/types";

export const OPEN_COMMAND_PALETTE_EVENT = "inseries:open-command-palette";

type UserResult = { id: string; username: string; name: string; avatarUrl: string | null };
type ListResult = { id: string; title: string; description: string | null; author: { username: string; name: string } };
type ReviewResult = { id: string; body: string; rating: number; author: { username: string; name: string }; series: { slug: string; title: string } };

type SearchResponse = {
  data: { series?: Series[]; users?: UserResult[]; lists?: ListResult[]; reviews?: ReviewResult[] };
};

type FlatItem = { key: string; href: string; onSelect?: () => void };

const QUICK_ACTIONS = [
  { href: "/calendar", label: "Abrir calendario", icon: CalendarIcon },
  { href: "/feed", label: "Ir para o feed", icon: FilmIcon },
  { href: "/lists?view=minhas", label: "Ver minhas listas", icon: ListIcon },
  { href: "/series", label: "Explorar series", icon: CompassIcon },
  { href: "/settings", label: "Configuracoes", icon: SettingsIcon }
] as const;

const RECENT_STORAGE_KEY = "inseries-recent-searches";
const MAX_RECENT = 5;

function loadRecent(): string[] {
  try {
    const raw = localStorage.getItem(RECENT_STORAGE_KEY);
    return raw ? (JSON.parse(raw) as string[]) : [];
  } catch {
    return [];
  }
}

function saveRecent(query: string) {
  try {
    const current = loadRecent().filter((item) => item !== query);
    const next = [query, ...current].slice(0, MAX_RECENT);
    localStorage.setItem(RECENT_STORAGE_KEY, JSON.stringify(next));
  } catch {
    // Storage unavailable (private mode) - recent history just won't persist.
  }
}

/**
 * Fase 4 (INSERIES-PRODUCT-EXPERIENCE-REVOLUTION-01) — Command Palette: busca central
 * (series/usuarios/listas/reviews, reaproveitando GET /api/search?type=all que ja existia e
 * ja fazia essa consulta multi-dominio — nenhuma logica de busca nova) + navegacao rapida.
 * Aberto por Ctrl/Cmd+K (global) ou pelo evento customizado `OPEN_COMMAND_PALETTE_EVENT`
 * (disparado pelo botao "Buscar" do DashboardHeader) — decoupled de props/contexto porque o
 * trigger e o palette vivem em subarvores React diferentes dentro do DashboardShell.
 */
export function CommandPalette() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResponse["data"] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const [recent, setRecent] = useState<string[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setOpen(true);
      }
    }
    function handleOpenEvent() {
      setOpen(true);
    }
    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener(OPEN_COMMAND_PALETTE_EVENT, handleOpenEvent);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener(OPEN_COMMAND_PALETTE_EVENT, handleOpenEvent);
    };
  }, []);

  useEffect(() => {
    if (open) {
      setRecent(loadRecent());
      requestAnimationFrame(() => inputRef.current?.focus());
    } else {
      setQuery("");
      setResults(null);
      setError(false);
      setActiveIndex(0);
    }
  }, [open]);

  useEffect(() => {
    if (!query.trim()) {
      setResults(null);
      setError(false);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(false);
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const response = await fetch(`/api/search?type=all&q=${encodeURIComponent(query)}&limit=5`, { signal: controller.signal });
        if (!response.ok) throw new Error("search_failed");
        const body = (await response.json()) as SearchResponse;
        setResults(body.data);
      } catch (err) {
        if ((err as Error).name !== "AbortError") setError(true);
      } finally {
        setLoading(false);
      }
    }, 250);

    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [query]);

  function navigate(href: string) {
    if (query.trim()) saveRecent(query.trim());
    setOpen(false);
    router.push(href);
  }

  const flatItems: FlatItem[] = useMemo(() => {
    if (!query.trim()) {
      return QUICK_ACTIONS.map((action) => ({ key: action.href, href: action.href }));
    }
    if (!results) return [];
    const items: FlatItem[] = [];
    for (const series of results.series ?? []) items.push({ key: `series-${series.id}`, href: `/series/${series.slug}` });
    for (const user of results.users ?? []) items.push({ key: `user-${user.id}`, href: `/profile/${user.username}` });
    for (const list of results.lists ?? []) items.push({ key: `list-${list.id}`, href: `/lists/${list.id}` });
    for (const review of results.reviews ?? []) items.push({ key: `review-${review.id}`, href: `/series/${review.series.slug}#reviews` });
    return items;
  }, [query, results]);

  function handleInputKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveIndex((current) => Math.min(current + 1, flatItems.length - 1));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((current) => Math.max(current - 1, 0));
    } else if (event.key === "Enter") {
      event.preventDefault();
      const item = flatItems[activeIndex];
      if (item) navigate(item.href);
    }
  }

  const hasQuery = query.trim().length > 0;
  const hasAnyResult = hasQuery && results && flatItems.length > 0;
  const isEmpty = hasQuery && !loading && !error && results && flatItems.length === 0;

  return (
    <Dialog open={open} onClose={() => setOpen(false)} size="lg" padded={false}>
      <div className="flex items-center gap-3 border-b border-border py-4 pl-5 pr-14">
        <SearchIcon className="h-5 w-5 shrink-0 text-subtle" aria-hidden />
        <input
          ref={inputRef}
          type="text"
          role="combobox"
          aria-expanded={flatItems.length > 0}
          aria-controls="command-palette-results"
          aria-label="Buscar series, usuarios, listas e reviews"
          placeholder="Buscar series, usuarios, listas... ou digitar uma acao"
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            setActiveIndex(0);
          }}
          onKeyDown={handleInputKeyDown}
          className="min-w-0 flex-1 bg-transparent text-base text-ink placeholder:text-subtle focus:outline-none"
        />
      </div>

      <div id="command-palette-results" role="listbox" aria-label="Resultados" className="max-h-[60vh] overflow-y-auto p-2">
        {!hasQuery ? (
          <>
            {recent.length ? (
              <div className="px-3 pb-1 pt-2 text-xs font-semibold uppercase tracking-wide text-subtle">Buscas recentes</div>
            ) : null}
            {recent.map((term) => (
              <button
                key={term}
                type="button"
                onClick={() => setQuery(term)}
                className="flex w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-left text-sm text-muted transition hover:bg-surface hover:text-ink"
              >
                <SearchIcon className="h-4 w-4 shrink-0" aria-hidden />
                {term}
              </button>
            ))}
            <div className="px-3 pb-1 pt-3 text-xs font-semibold uppercase tracking-wide text-subtle">Acoes rapidas</div>
            {QUICK_ACTIONS.map((action, index) => (
              <button
                key={action.href}
                type="button"
                onClick={() => navigate(action.href)}
                onMouseEnter={() => setActiveIndex(index)}
                className={cn(
                  "flex w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-left text-sm transition",
                  activeIndex === index ? "bg-primary/10 text-primary-text" : "text-ink hover:bg-surface"
                )}
              >
                <action.icon className="h-4 w-4 shrink-0" aria-hidden />
                {action.label}
              </button>
            ))}
          </>
        ) : (
          <>
            {loading ? (
              <div className="flex items-center justify-center gap-2 py-10 text-sm text-subtle">
                <Spinner size="sm" /> Buscando...
              </div>
            ) : null}

            {error ? (
              <div className="flex flex-col items-center gap-2 py-10 text-center text-sm text-subtle">
                <AlertCircleIcon className="h-6 w-6" aria-hidden />
                Nao foi possivel buscar agora. Tente de novo.
              </div>
            ) : null}

            {isEmpty ? (
              <div className="flex flex-col items-center gap-2 py-10 text-center text-sm text-subtle">
                <SearchIcon className="h-6 w-6" aria-hidden />
                Nenhum resultado para &quot;{query}&quot;.
              </div>
            ) : null}

            {hasAnyResult ? (
              <>
                {results?.series?.length ? (
                  <ResultGroup label="Series">
                    {results.series.map((series) => {
                      const globalIndex = flatItems.findIndex((item) => item.key === `series-${series.id}`);
                      return (
                        <button
                          key={series.id}
                          type="button"
                          onClick={() => navigate(`/series/${series.slug}`)}
                          onMouseEnter={() => setActiveIndex(globalIndex)}
                          className={cn(
                            "flex w-full items-center gap-3 rounded-2xl px-3 py-2 text-left transition",
                            activeIndex === globalIndex ? "bg-primary/10" : "hover:bg-surface"
                          )}
                        >
                          <span className="relative h-12 w-8 shrink-0 overflow-hidden rounded-lg">
                            <PosterImage src={series.posterUrl} alt={series.title} sizes="32px" />
                          </span>
                          <span className="min-w-0 flex-1 truncate text-sm font-medium text-ink">{series.title}</span>
                        </button>
                      );
                    })}
                  </ResultGroup>
                ) : null}

                {results?.users?.length ? (
                  <ResultGroup label="Usuarios">
                    {results.users.map((user) => {
                      const globalIndex = flatItems.findIndex((item) => item.key === `user-${user.id}`);
                      return (
                        <button
                          key={user.id}
                          type="button"
                          onClick={() => navigate(`/profile/${user.username}`)}
                          onMouseEnter={() => setActiveIndex(globalIndex)}
                          className={cn(
                            "flex w-full items-center gap-3 rounded-2xl px-3 py-2 text-left transition",
                            activeIndex === globalIndex ? "bg-primary/10" : "hover:bg-surface"
                          )}
                        >
                          <Avatar label={getInitials(user.name)} name={user.name} src={user.avatarUrl} size="sm" />
                          <span className="min-w-0 flex-1 truncate text-sm font-medium text-ink">
                            {user.name} <span className="text-subtle">@{user.username}</span>
                          </span>
                        </button>
                      );
                    })}
                  </ResultGroup>
                ) : null}

                {results?.lists?.length ? (
                  <ResultGroup label="Listas">
                    {results.lists.map((list) => {
                      const globalIndex = flatItems.findIndex((item) => item.key === `list-${list.id}`);
                      return (
                        <button
                          key={list.id}
                          type="button"
                          onClick={() => navigate(`/lists/${list.id}`)}
                          onMouseEnter={() => setActiveIndex(globalIndex)}
                          className={cn(
                            "flex w-full items-center gap-3 rounded-2xl px-3 py-2 text-left transition",
                            activeIndex === globalIndex ? "bg-primary/10" : "hover:bg-surface"
                          )}
                        >
                          <ListIcon className="h-5 w-5 shrink-0 text-subtle" aria-hidden />
                          <span className="min-w-0 flex-1 truncate text-sm font-medium text-ink">{list.title}</span>
                        </button>
                      );
                    })}
                  </ResultGroup>
                ) : null}

                {results?.reviews?.length ? (
                  <ResultGroup label="Reviews">
                    {results.reviews.map((review) => {
                      const globalIndex = flatItems.findIndex((item) => item.key === `review-${review.id}`);
                      return (
                        <button
                          key={review.id}
                          type="button"
                          onClick={() => navigate(`/series/${review.series.slug}#reviews`)}
                          onMouseEnter={() => setActiveIndex(globalIndex)}
                          className={cn(
                            "flex w-full items-start gap-3 rounded-2xl px-3 py-2 text-left transition",
                            activeIndex === globalIndex ? "bg-primary/10" : "hover:bg-surface"
                          )}
                        >
                          <Badge variant="warning" className="mt-0.5 shrink-0">
                            <StarIcon className="h-3 w-3 fill-current" /> {review.rating}/5
                          </Badge>
                          <span className="min-w-0 flex-1">
                            <span className="line-clamp-1 text-sm font-medium text-ink">{review.series.title}</span>
                            <span className="line-clamp-1 block text-xs text-subtle">{review.body}</span>
                          </span>
                        </button>
                      );
                    })}
                  </ResultGroup>
                ) : null}
              </>
            ) : null}
          </>
        )}
      </div>
    </Dialog>
  );
}

function ResultGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="pb-2">
      <div className="px-3 pb-1 pt-2 text-xs font-semibold uppercase tracking-wide text-subtle">{label}</div>
      {children}
    </div>
  );
}
