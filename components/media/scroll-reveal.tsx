"use client";

import { useEffect, useRef, useState, type PropsWithChildren } from "react";
import { cn } from "@/lib/utils";

/**
 * Fase 13 (INSERIES-LANDING-CINEMATIC-IMMERSION-01) — a thin `IntersectionObserver` wrapper
 * that fades+slides a section in the first time it enters the viewport ("scroll reveal").
 * Reuses the existing `fade-in-up` keyframe (tailwind.config.ts) instead of a new one.
 * Renders children immediately in the server-rendered HTML (only the *reveal* is
 * client-side/progressive) — nothing is hidden from crawlers or no-JS clients, and
 * `prefers-reduced-motion` already collapses the transition globally (app/globals.css).
 */
export function ScrollReveal({ children, className }: PropsWithChildren<{ className?: string }>) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.1, rootMargin: "0px 0px -10% 0px" }
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      className={cn("transition-all duration-700 ease-out", visible ? "translate-y-0 opacity-100" : "translate-y-4 opacity-0", className)}
    >
      {children}
    </div>
  );
}
