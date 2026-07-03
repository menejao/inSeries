const STORAGE_KEY = "inseries-theme";

/**
 * Runs synchronously in <head>, before first paint, so the correct theme is
 * on <html data-theme> the moment CSS applies — no flash of the wrong theme.
 * Mirrors the read/resolve logic in theme-provider.tsx exactly.
 *
 * Three stored states: "light", "dark", "system". A first-time visitor (no
 * stored value) always gets "dark" — inSeries is dark-by-default, it does
 * NOT infer the initial theme from the OS preference. "system" is only ever
 * reached by an explicit user choice, and from then on tracks the OS.
 */
const bootScript = `
(function () {
  try {
    var stored = localStorage.getItem("${STORAGE_KEY}");
    var resolved = "dark";
    if (stored === "light" || stored === "dark") {
      resolved = stored;
    } else if (stored === "system") {
      resolved = window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark";
    }
    document.documentElement.setAttribute("data-theme", resolved);
  } catch (e) {
    document.documentElement.setAttribute("data-theme", "dark");
  }
})();
`;

export function ThemeScript() {
  return <script dangerouslySetInnerHTML={{ __html: bootScript }} />;
}

export const THEME_STORAGE_KEY = STORAGE_KEY;
