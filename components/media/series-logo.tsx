"use client";

import Image from "next/image";
import { useState } from "react";
import { cn } from "@/lib/utils";

/**
 * Fase 6 (INSERIES-CATALOG-INTELLIGENCE-EXPERIENCE-01) — "logo > titulo em texto, nunca
 * duplicar informacao": when a series has an official logo, render it instead of the text
 * title (not alongside it) — the title still exists for screen readers (`sr-only`), just
 * never rendered twice visually. Falls back to plain text whenever there's no logo, or the
 * logo image fails to load (same graceful-fallback pattern as PosterImage/BackdropImage).
 */
export function SeriesLogoOrTitle({
  title,
  logoUrl,
  as: Tag = "h1",
  textClassName,
  logoClassName
}: {
  title: string;
  logoUrl?: string | null;
  as?: "h1" | "h2" | "p" | "span";
  textClassName?: string;
  logoClassName?: string;
}) {
  const [failed, setFailed] = useState(false);

  if (logoUrl && !failed) {
    return (
      <div className={cn("relative", logoClassName)}>
        <span className="sr-only">{title}</span>
        <Image
          src={logoUrl}
          alt={title}
          width={400}
          height={140}
          className="h-auto max-h-full w-auto max-w-full object-contain object-left drop-shadow-lg"
          onError={() => setFailed(true)}
        />
      </div>
    );
  }

  return <Tag className={textClassName}>{title}</Tag>;
}
