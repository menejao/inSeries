"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type PropsWithChildren } from "react";
import { THEME_STORAGE_KEY } from "@/components/theme/theme-script";

/** What the user picked. "system" tracks the OS and is only reached by an explicit choice — never the silent default. */
export type ThemeMode = "light" | "dark" | "system";
/** What's actually applied to <html data-theme> — always one of these two. */
type ResolvedTheme = "light" | "dark";

type ThemeContextValue = {
  mode: ThemeMode;
  resolvedTheme: ResolvedTheme;
  setMode: (mode: ThemeMode) => void;
  toggleTheme: () => void;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

function readInitialMode(): ThemeMode {
  if (typeof window === "undefined") return "dark";
  try {
    const stored = localStorage.getItem(THEME_STORAGE_KEY);
    if (stored === "light" || stored === "dark" || stored === "system") return stored;
  } catch {
    // Storage can be unavailable (private mode) — fall through to the dark default.
  }
  return "dark";
}

function resolveTheme(mode: ThemeMode): ResolvedTheme {
  if (mode === "system") {
    if (typeof window === "undefined") return "dark";
    return window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark";
  }
  return mode;
}

export function ThemeProvider({ children }: PropsWithChildren) {
  const [mode, setModeState] = useState<ThemeMode>(readInitialMode);
  const [resolvedTheme, setResolvedTheme] = useState<ResolvedTheme>(() => resolveTheme(readInitialMode()));

  const applyResolved = useCallback((next: ResolvedTheme) => {
    setResolvedTheme(next);
    document.documentElement.setAttribute("data-theme", next);
  }, []);

  const setMode = useCallback(
    (next: ThemeMode) => {
      setModeState(next);
      applyResolved(resolveTheme(next));
      try {
        localStorage.setItem(THEME_STORAGE_KEY, next);
      } catch {
        // Storage can be unavailable (private mode); the choice just won't persist.
      }
    },
    [applyResolved]
  );

  const toggleTheme = useCallback(() => {
    setMode(resolvedTheme === "dark" ? "light" : "dark");
  }, [resolvedTheme, setMode]);

  // "system" mode keeps tracking the OS after the initial resolve.
  useEffect(() => {
    if (mode !== "system") return;
    const media = window.matchMedia("(prefers-color-scheme: light)");
    const handleChange = () => applyResolved(resolveTheme("system"));
    media.addEventListener("change", handleChange);
    return () => media.removeEventListener("change", handleChange);
  }, [mode, applyResolved]);

  // Keep in sync if the user changes theme in another tab.
  useEffect(() => {
    function handleStorage(event: StorageEvent) {
      if (event.key !== THEME_STORAGE_KEY) return;
      const next = event.newValue === "light" || event.newValue === "dark" || event.newValue === "system" ? event.newValue : "dark";
      setModeState(next);
      applyResolved(resolveTheme(next));
    }
    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, [applyResolved]);

  const value = useMemo(() => ({ mode, resolvedTheme, setMode, toggleTheme }), [mode, resolvedTheme, setMode, toggleTheme]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within ThemeProvider");
  return ctx;
}
