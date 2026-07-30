"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Avatar } from "@/components/ui/avatar";
import { SearchBar } from "@/components/ui/search-bar";
import { getInitials } from "@/lib/utils";

type UserResult = { id: string; name: string; username: string; avatarUrl: string | null };

/**
 * INSERIES-FEED-REDESIGN-01 — "a busca de usuarios passara a fazer parte do Feed... deve
 * permanecer acessivel durante toda a navegacao": um unico typeahead, montado uma vez no topo
 * da pagina (acima das tabs Para voce/Seguindo/Global), busca em tempo real e abre o perfil ao
 * selecionar — substitui por completo a pagina /explore.
 */
export function UserSearchBar() {
  const router = useRouter();
  const containerRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<UserResult[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) setOpen(false);
    }
    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, []);

  function handleChange(value: string) {
    setQuery(value);
    setOpen(true);
    if (debounceRef.current) clearTimeout(debounceRef.current);

    const trimmed = value.trim();
    if (!trimmed) {
      setResults(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    debounceRef.current = setTimeout(async () => {
      const response = await fetch(`/api/users/search?q=${encodeURIComponent(trimmed)}`);
      const payload = await response.json().catch(() => ({ data: [] }));
      setResults(payload.data ?? []);
      setLoading(false);
    }, 300);
  }

  function selectUser(username: string) {
    setOpen(false);
    setQuery("");
    setResults(null);
    router.push(`/profile/${username}`);
  }

  return (
    <div ref={containerRef} className="relative">
      <SearchBar
        label="Buscar por nome ou @username"
        placeholder="Buscar por nome ou @username"
        value={query}
        onChange={(event) => handleChange(event.target.value)}
        onFocus={() => query.trim() && setOpen(true)}
      />

      {open && query.trim() ? (
        <div className="absolute inset-x-0 top-full z-20 mt-2 max-h-80 overflow-y-auto rounded-2xl border border-border bg-surface-strong p-1.5 shadow-raised">
          {loading ? (
            <p className="px-3 py-2.5 text-sm text-subtle">Buscando...</p>
          ) : results && results.length ? (
            results.map((user) => (
              <button
                key={user.id}
                type="button"
                onClick={() => selectUser(user.username)}
                className="flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-left transition hover:bg-surface"
              >
                <Avatar label={getInitials(user.name)} name={user.name} src={user.avatarUrl} size="sm" />
                <span className="min-w-0">
                  <span className="block truncate text-sm font-semibold text-ink">{user.name}</span>
                  <span className="block truncate text-xs text-subtle">@{user.username}</span>
                </span>
              </button>
            ))
          ) : (
            <p className="px-3 py-2.5 text-sm text-subtle">Nenhum usuario encontrado.</p>
          )}
        </div>
      ) : null}
    </div>
  );
}
