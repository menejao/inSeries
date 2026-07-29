"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { WrappedSlideContent } from "@/components/recap-wrapped/wrapped-slide";
import { ChevronLeftIcon, XIcon } from "@/components/ui/icons";
import { cn } from "@/lib/utils";
import type { WrappedData } from "@/lib/recap/wrapped-types";

const SLIDE_DURATION_MS = 6500;
const EXIT_HREF = "/";

/**
 * INSERIES-RECAP-ENGINE-01 — "a navegacao deve lembrar Stories": full-screen, one segmented
 * progress bar per slide (fills automatically, restarts on manual navigation), tap left/right
 * halves, arrow keys, space, and Escape to exit. Auto-advance pauses while a Sheet (the share
 * picker) is open on the last slide, so it never advances past the end mid-interaction.
 */
export function WrappedExperience({ data }: { data: WrappedData }) {
  const router = useRouter();
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const timerRef = useRef<number | null>(null);
  const total = data.slides.length;
  const isLast = index === total - 1;

  const goTo = useCallback(
    (next: number) => {
      if (next < 0) return;
      if (next >= total) {
        router.push(EXIT_HREF);
        return;
      }
      setIndex(next);
    },
    [router, total]
  );

  useEffect(() => {
    if (paused || isLast) return;
    timerRef.current = window.setTimeout(() => goTo(index + 1), SLIDE_DURATION_MS);
    return () => {
      if (timerRef.current) window.clearTimeout(timerRef.current);
    };
  }, [index, paused, isLast, goTo]);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "ArrowRight" || event.key === " ") {
        event.preventDefault();
        goTo(index + 1);
      } else if (event.key === "ArrowLeft") {
        goTo(index - 1);
      } else if (event.key === "Escape") {
        router.push(EXIT_HREF);
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [index, goTo, router]);

  function handleTap(event: React.MouseEvent<HTMLDivElement>) {
    const target = event.target as HTMLElement;
    if (target.closest("button, a, [role='dialog']")) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const tapX = event.clientX - rect.left;
    if (tapX < rect.width * 0.35) goTo(index - 1);
    else goTo(index + 1);
  }

  return (
    <div className="fixed inset-0 z-50 overflow-hidden bg-canvas text-ink" onPointerDown={() => setPaused(true)} onPointerUp={() => setPaused(false)}>
      <div className="absolute inset-x-0 top-0 z-20 flex gap-1.5 p-3 pt-[calc(0.75rem+env(safe-area-inset-top))]" role="progressbar" aria-valuenow={index + 1} aria-valuemin={1} aria-valuemax={total}>
        {data.slides.map((slide, slideIndex) => (
          <div key={slideIndex} className="h-1 flex-1 overflow-hidden rounded-full bg-surface-strong/60">
            <div
              className={cn(
                "h-full rounded-full bg-ink",
                slideIndex < index && "w-full",
                slideIndex > index && "w-0"
              )}
              style={
                slideIndex === index
                  ? { width: "100%", transitionProperty: "width", transitionTimingFunction: "linear", transitionDuration: paused || isLast ? "0ms" : `${SLIDE_DURATION_MS}ms` }
                  : undefined
              }
            />
          </div>
        ))}
      </div>

      <button
        type="button"
        onClick={() => router.push(EXIT_HREF)}
        aria-label="Fechar Recap"
        className="absolute right-3 top-[calc(2.5rem+env(safe-area-inset-top))] z-20 flex h-9 w-9 items-center justify-center rounded-full bg-canvas/60 text-ink backdrop-blur transition hover:bg-canvas/90"
      >
        <XIcon className="h-5 w-5" />
      </button>

      {index > 0 ? (
        <button
          type="button"
          onClick={() => goTo(index - 1)}
          aria-label="Slide anterior"
          className="absolute left-3 top-1/2 z-20 hidden -translate-y-1/2 items-center justify-center rounded-full bg-canvas/60 p-2 text-ink backdrop-blur transition hover:bg-canvas/90 lg:flex"
        >
          <ChevronLeftIcon className="h-5 w-5" />
        </button>
      ) : null}

      <div className="h-full w-full cursor-pointer" onClick={handleTap}>
        <div key={index} className="h-full w-full animate-fade-in">
          <WrappedSlideContent slide={data.slides[index]} />
        </div>
      </div>
    </div>
  );
}
