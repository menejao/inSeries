"use client";

import { useState, useTransition } from "react";

function toInputValue(iso: string) {
  return iso.slice(0, 10); // "YYYY-MM-DD"
}

function formatDate(iso: string) {
  // Parse as local midnight to avoid UTC-offset display shift
  const [year, month, day] = iso.slice(0, 10).split("-").map(Number);
  return new Date(year, month - 1, day).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "short",
    year: "numeric"
  });
}

export function EpisodeWatchedAtEditor({ episodeId, initialWatchedAt }: { episodeId: string; initialWatchedAt: string }) {
  const [editing, setEditing] = useState(false);
  const [watchedAt, setWatchedAt] = useState(initialWatchedAt);
  const [isPending, startTransition] = useTransition();

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const value = e.target.value; // "YYYY-MM-DD"
    if (!value) return;
    // Send noon UTC to avoid off-by-one day in any timezone
    const iso = `${value}T12:00:00.000Z`;
    setEditing(false);
    startTransition(async () => {
      const response = await fetch(`/api/episodes/${episodeId}/watched-at`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ watchedAt: iso })
      });
      if (response.ok) {
        const json = await response.json();
        setWatchedAt(json.data.watchedAt);
      }
    });
  }

  const today = new Date().toISOString().slice(0, 10);

  if (editing) {
    return (
      <input
        type="date"
        defaultValue={toInputValue(watchedAt)}
        max={today}
        autoFocus
        onChange={handleChange}
        onBlur={() => setEditing(false)}
        className="rounded border border-border bg-transparent px-1 py-0.5 text-xs text-subtle outline-none focus:border-primary"
      />
    );
  }

  return (
    <button
      type="button"
      disabled={isPending}
      onClick={() => setEditing(true)}
      title="Clique para editar a data"
      className="text-xs text-subtle underline-offset-2 transition hover:text-ink hover:underline disabled:opacity-50"
    >
      {formatDate(watchedAt)}
    </button>
  );
}
