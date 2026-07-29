"use client";

import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { ChevronRightIcon, SparklesIcon } from "@/components/ui/icons";

const AUTO_ROTATE_MS = 6000;

/** INSERIES-STATISTICS-ENGINE-01 — "card rotativo" de curiosidades: avanca sozinho e tambem manualmente. */
export function CuriosityCarousel({ curiosities }: { curiosities: string[] }) {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (curiosities.length < 2) return;
    const interval = window.setInterval(() => setIndex((current) => (current + 1) % curiosities.length), AUTO_ROTATE_MS);
    return () => window.clearInterval(interval);
  }, [curiosities.length]);

  if (curiosities.length === 0) return null;

  return (
    <Card className="flex items-center justify-between gap-4" padding="sm">
      <div className="flex items-center gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-warning/12 text-warning-text">
          <SparklesIcon className="h-4 w-4" />
        </span>
        <p key={index} className="animate-fade-in text-sm leading-6 text-ink">
          {curiosities[index]}
        </p>
      </div>
      {curiosities.length > 1 ? (
        <button
          type="button"
          onClick={() => setIndex((current) => (current + 1) % curiosities.length)}
          aria-label="Proxima curiosidade"
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-muted transition hover:bg-surface-strong hover:text-ink"
        >
          <ChevronRightIcon className="h-4 w-4" />
        </button>
      ) : null}
    </Card>
  );
}
