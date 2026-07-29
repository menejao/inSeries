"use client";

import { useState, type CSSProperties } from "react";
import { cn } from "@/lib/utils";

const COLORS = ["bg-primary", "bg-success", "bg-warning", "bg-secondary", "bg-danger"];
const PIECE_COUNT = 24;

type ConfettiPieceStyle = CSSProperties & { "--confetti-x": string; "--confetti-y": string };

/**
 * INSERIES-STATISTICS-ENGINE-01 — "confetes em conquistas". Pure CSS keyframe burst (see
 * `confetti-burst` in tailwind.config.ts), no canvas/dependency: a fixed set of absolutely-
 * positioned pieces that animate once. Deliberately opt-in (button trigger) rather than
 * auto-firing on load — "evitar animacoes exageradas" and a page load shouldn't force an
 * animation the user didn't ask for.
 */
export function Confetti({ trigger, children }: { trigger: React.ReactNode; children?: React.ReactNode }) {
  const [active, setActive] = useState(false);

  return (
    <div className="relative inline-flex">
      <button
        type="button"
        onClick={() => {
          setActive(true);
          window.setTimeout(() => setActive(false), 1200);
        }}
      >
        {trigger}
      </button>
      {children}
      {active ? (
        <div className="pointer-events-none absolute inset-0 overflow-visible">
          {Array.from({ length: PIECE_COUNT }).map((_, index) => {
            const angle = (index / PIECE_COUNT) * 360;
            const distance = 60 + (index % 3) * 20;
            const color = COLORS[index % COLORS.length];
            const style: ConfettiPieceStyle = {
              animationDelay: `${(index % 5) * 20}ms`,
              "--confetti-x": `${Math.cos((angle * Math.PI) / 180) * distance}px`,
              "--confetti-y": `${Math.sin((angle * Math.PI) / 180) * distance}px`
            };
            return (
              <span
                key={index}
                className={cn("absolute left-1/2 top-1/2 h-1.5 w-1.5 rounded-full opacity-0 animate-confetti-burst", color)}
                style={style}
              />
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
