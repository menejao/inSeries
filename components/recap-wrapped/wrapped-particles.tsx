const PARTICLES = Array.from({ length: 14 }, (_, index) => ({
  left: `${(index * 37) % 100}%`,
  top: `${(index * 53) % 100}%`,
  size: 3 + (index % 3),
  delay: `${(index % 7) * 0.4}s`,
  duration: `${6 + (index % 5)}s`
}));

/** INSERIES-RECAP-ENGINE-01 — "particulas leves". Pure CSS, no canvas/dependency — a handful of softly pulsing dots over the ambient gradient. */
export function WrappedParticles() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
      {PARTICLES.map((particle, index) => (
        <span
          key={index}
          className="absolute rounded-full bg-primary/40 animate-pulse"
          style={{
            left: particle.left,
            top: particle.top,
            width: particle.size,
            height: particle.size,
            animationDelay: particle.delay,
            animationDuration: particle.duration
          }}
        />
      ))}
    </div>
  );
}
