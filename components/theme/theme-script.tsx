const STORAGE_KEY = "inseries-theme";

/**
 * Runs synchronously in <head>, before first paint, so the correct theme is
 * on <html data-theme> the moment CSS applies — no flash of the wrong theme.
 * Mirrors the read/fallback logic in theme-provider.tsx exactly.
 */
const bootScript = `
(function () {
  try {
    var stored = localStorage.getItem("${STORAGE_KEY}");
    var theme = stored === "light" || stored === "dark"
      ? stored
      : (window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark");
    document.documentElement.setAttribute("data-theme", theme);
  } catch (e) {
    document.documentElement.setAttribute("data-theme", "dark");
  }
})();
`;

export function ThemeScript() {
  return <script dangerouslySetInnerHTML={{ __html: bootScript }} />;
}

export const THEME_STORAGE_KEY = STORAGE_KEY;
