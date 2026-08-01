/**
 * Inline SVG icon set (strings, not React components).
 *
 * The visual language is copied from `components/ui/icons.tsx` in the main app (24x24 viewBox,
 * stroke-based, `currentColor`) so the generated art matches the product, but this module is
 * deliberately standalone: it renders outside the Next.js tree (inside a Playwright page), so it
 * cannot import a `.tsx` React component.
 */

export type IconName = "star" | "play" | "tv" | "sparkles" | "fire" | "calendar" | "poll" | "arrow-right" | "heart" | "bookmark";

function icon(body: string, opts: { filled?: boolean } = {}): (size?: number, className?: string) => string {
  return (size = 32, className = "") =>
    `<svg viewBox="0 0 24 24" width="${size}" height="${size}" class="${className}" fill="${opts.filled ? "currentColor" : "none"}" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${body}</svg>`;
}

export const icons: Record<IconName, (size?: number, className?: string) => string> = {
  star: icon(`<path d="m12 3.5 2.6 5.3 5.9.9-4.3 4.1 1 5.8-5.2-2.7-5.2 2.7 1-5.8L3.5 9.7l5.9-.9L12 3.5Z" />`, { filled: true }),
  play: icon(`<circle cx="12" cy="12" r="9" /><path d="M10 8.5v7l6-3.5-6-3.5Z" />`),
  tv: icon(`<rect x="3" y="6" width="18" height="13" rx="2.5" /><path d="M8 21h8M9 3l3 3 3-3" />`),
  sparkles: icon(`<path d="m12 3 1.8 4.7L18.5 9.5 13.8 11.3 12 16l-1.8-4.7L5.5 9.5l4.7-1.8L12 3Z" /><path d="M18.5 16.5 19.4 19l2.5.9-2.5.9-.9 2.5-.9-2.5-2.5-.9 2.5-.9.9-2.5Z" />`),
  fire: icon(`<path d="M12 3s4.5 3.6 4.5 8a4.5 4.5 0 0 1-9 0c0-1.6.7-2.9 1.4-3.8.2 1.4.9 2.3 1.8 2.3 1.1 0 1.6-1.2 1.3-6.5Z" /><path d="M7 13a5 5 0 0 0 10 0" />`),
  calendar: icon(`<rect x="3.5" y="5" width="17" height="15" rx="2.5" /><path d="M3.5 10h17M8 3v4M16 3v4" />`),
  poll: icon(`<path d="M5 20V10M12 20V4M19 20v-7" />`),
  "arrow-right": icon(`<path d="M4 12h15M13 6l6 6-6 6" />`),
  heart: icon(`<path d="M12 20s-7-4.4-7-9.2A3.8 3.8 0 0 1 12 8a3.8 3.8 0 0 1 7 2.8C19 15.6 12 20 12 20Z" />`, { filled: true }),
  bookmark: icon(`<path d="M7 4h10a1 1 0 0 1 1 1v15l-6-3.6L6 20V5a1 1 0 0 1 1-1Z" />`)
};

export function renderIcon(name: IconName, size = 32, className = ""): string {
  const factory = icons[name];
  if (!factory) return "";
  return factory(size, className);
}
