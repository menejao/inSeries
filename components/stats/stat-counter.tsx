"use client";

import { useEffect, useRef, useState } from "react";

const DURATION_MS = 900;

/** INSERIES-STATISTICS-ENGINE-01 — "contadores animados". Counts up from 0 to `value` once on mount, respects prefers-reduced-motion. */
export function StatCounter({ value, suffix = "", className }: { value: number; suffix?: string; className?: string }) {
  const [display, setDisplay] = useState(0);
  const frameRef = useRef<number | null>(null);

  useEffect(() => {
    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (prefersReducedMotion) {
      setDisplay(value);
      return;
    }

    const start = performance.now();
    function tick(now: number) {
      const progress = Math.min(1, (now - start) / DURATION_MS);
      const eased = 1 - (1 - progress) * (1 - progress);
      setDisplay(Math.round(value * eased));
      if (progress < 1) frameRef.current = requestAnimationFrame(tick);
    }
    frameRef.current = requestAnimationFrame(tick);

    return () => {
      if (frameRef.current) cancelAnimationFrame(frameRef.current);
    };
  }, [value]);

  return (
    <span className={className}>
      {display.toLocaleString("pt-BR")}
      {suffix}
    </span>
  );
}
