"use client";

import Image from "next/image";
import { useState } from "react";
import { TvIcon } from "@/components/ui/icons";
import { cn } from "@/lib/utils";

/**
 * Fase 10 — a single place that decides what a poster/backdrop/still looks like when the
 * catalog doesn't have one yet (still importing, or a field TMDb never returned). Never a
 * broken image icon, never a blank rectangle: always a themed gradient with an icon.
 */
type ImageBoxProps = {
  src?: string | null;
  alt: string;
  sizes?: string;
  priority?: boolean;
  className?: string;
  /** Applied to the image/fallback itself, not the clipping box — for hover-zoom effects. */
  imageClassName?: string;
};

export function PosterImage({
  src,
  alt,
  sizes = "(min-width: 1024px) 220px, (min-width: 640px) 33vw, 45vw",
  priority = false,
  className,
  imageClassName
}: ImageBoxProps) {
  const [failed, setFailed] = useState(false);
  const showFallback = !src || failed;

  return (
    <div className={cn("relative h-full w-full overflow-hidden bg-surface-strong", className)}>
      {showFallback ? (
        <ImageFallback label={alt} className={imageClassName} />
      ) : (
        <Image
          src={src as string}
          alt={alt}
          fill
          sizes={sizes}
          priority={priority}
          className={cn("object-cover", imageClassName)}
          onError={() => setFailed(true)}
        />
      )}
    </div>
  );
}

export function BackdropImage({
  src,
  alt,
  sizes = "100vw",
  priority = false,
  className,
  imageClassName
}: ImageBoxProps) {
  const [failed, setFailed] = useState(false);
  const showFallback = !src || failed;

  return (
    <div className={cn("relative h-full w-full overflow-hidden bg-surface-strong", className)}>
      {showFallback ? (
        <ImageFallback label={alt} large className={imageClassName} />
      ) : (
        <Image
          src={src as string}
          alt={alt}
          fill
          sizes={sizes}
          priority={priority}
          className={cn("object-cover", imageClassName)}
          onError={() => setFailed(true)}
        />
      )}
    </div>
  );
}

function ImageFallback({ label, large = false, className }: { label: string; large?: boolean; className?: string }) {
  return (
    <div
      className={cn(
        "flex h-full w-full flex-col items-center justify-center gap-2 bg-gradient-to-br from-surface-strong via-surface to-canvas p-4 text-center",
        className
      )}
    >
      <TvIcon className={cn("text-subtle", large ? "h-10 w-10" : "h-7 w-7")} />
      <p className={cn("line-clamp-2 font-medium text-subtle", large ? "text-sm" : "text-xs")}>{label}</p>
    </div>
  );
}
