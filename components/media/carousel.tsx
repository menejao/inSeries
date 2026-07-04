"use client";

import { useRef, type PropsWithChildren } from "react";
import { ChevronLeftIcon, ChevronRightIcon } from "@/components/ui/icons";
import { cn } from "@/lib/utils";

/**
 * Fase 3/15 — the horizontal-scroll shelf every catalog section (Landing carousels, similar
 * series, etc.) uses. Native scroll-snap does the touch/mobile work for free; the arrow
 * buttons are a desktop-only affordance layered on top (hidden on touch via lg:flex).
 */
export function Carousel({ children, className }: PropsWithChildren<{ className?: string }>) {
  const trackRef = useRef<HTMLDivElement>(null);

  function scrollByAmount(direction: 1 | -1) {
    const track = trackRef.current;
    if (!track) return;
    track.scrollBy({ left: direction * track.clientWidth * 0.85, behavior: "smooth" });
  }

  return (
    <div className={cn("group/carousel relative", className)}>
      <div
        ref={trackRef}
        className="flex snap-x snap-mandatory gap-4 overflow-x-auto scroll-smooth pb-2 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {children}
      </div>
      <button
        type="button"
        onClick={() => scrollByAmount(-1)}
        aria-label="Rolar para o inicio"
        className="absolute -left-3 top-1/2 hidden -translate-y-1/2 items-center justify-center rounded-full border border-border bg-surface-strong/90 p-2 text-ink opacity-0 shadow-raised backdrop-blur transition duration-150 hover:bg-surface-strong group-hover/carousel:opacity-100 lg:flex"
      >
        <ChevronLeftIcon className="h-5 w-5" />
      </button>
      <button
        type="button"
        onClick={() => scrollByAmount(1)}
        aria-label="Rolar para o fim"
        className="absolute -right-3 top-1/2 hidden -translate-y-1/2 items-center justify-center rounded-full border border-border bg-surface-strong/90 p-2 text-ink opacity-0 shadow-raised backdrop-blur transition duration-150 hover:bg-surface-strong group-hover/carousel:opacity-100 lg:flex"
      >
        <ChevronRightIcon className="h-5 w-5" />
      </button>
    </div>
  );
}

export function CarouselItem({ children, className }: PropsWithChildren<{ className?: string }>) {
  return <div className={cn("w-40 shrink-0 snap-start sm:w-44 lg:w-48", className)}>{children}</div>;
}
