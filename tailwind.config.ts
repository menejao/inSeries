import type { Config } from "tailwindcss";

/**
 * Every color below is backed by an RGB-triplet CSS variable (see app/globals.css),
 * redefined per theme under `:root` (dark, default) and `:root[data-theme="light"]`.
 * The `<alpha-value>` placeholder lets Tailwind's opacity modifiers (bg-surface/60)
 * keep working across both themes.
 */
const withAlpha = (variable: string) => `rgb(var(${variable}) / <alpha-value>)`;

const config: Config = {
  darkMode: ["class", '[data-theme="dark"]'],
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./lib/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        canvas: withAlpha("--c-canvas"),
        surface: {
          DEFAULT: withAlpha("--c-surface"),
          strong: withAlpha("--c-surface-strong")
        },
        border: {
          DEFAULT: withAlpha("--c-border"),
          strong: withAlpha("--c-border-strong")
        },
        ink: withAlpha("--c-ink"),
        muted: withAlpha("--c-muted"),
        subtle: withAlpha("--c-subtle"),
        primary: {
          DEFAULT: withAlpha("--c-primary"),
          hover: withAlpha("--c-primary-hover"),
          foreground: withAlpha("--c-primary-foreground"),
          text: withAlpha("--c-primary-text")
        },
        secondary: {
          DEFAULT: withAlpha("--c-secondary"),
          hover: withAlpha("--c-secondary-hover"),
          foreground: withAlpha("--c-secondary-foreground"),
          text: withAlpha("--c-secondary-text")
        },
        success: {
          DEFAULT: withAlpha("--c-success"),
          foreground: withAlpha("--c-success-foreground"),
          text: withAlpha("--c-success-text")
        },
        warning: {
          DEFAULT: withAlpha("--c-warning"),
          foreground: withAlpha("--c-warning-foreground"),
          text: withAlpha("--c-warning-text")
        },
        danger: {
          DEFAULT: withAlpha("--c-danger"),
          foreground: withAlpha("--c-danger-foreground"),
          text: withAlpha("--c-danger-text")
        },
        ring: withAlpha("--c-ring"),
        overlay: withAlpha("--c-overlay")
      },
      fontFamily: {
        sans: [
          "-apple-system",
          "BlinkMacSystemFont",
          "\"Segoe UI\"",
          "Inter",
          "Roboto",
          "\"Helvetica Neue\"",
          "Arial",
          "sans-serif"
        ]
      },
      boxShadow: {
        xs: "0 1px 2px rgb(var(--c-shadow) / 0.06)",
        card: "0 1px 2px rgb(var(--c-shadow) / 0.08), 0 12px 32px -8px rgb(var(--c-shadow) / var(--shadow-strength))",
        raised: "0 2px 6px rgb(var(--c-shadow) / 0.1), 0 24px 48px -12px rgb(var(--c-shadow) / var(--shadow-strength))",
        glow: "0 0 0 1px rgb(var(--c-primary) / 0.4), 0 8px 24px -4px rgb(var(--c-primary) / 0.35)"
      },
      borderRadius: {
        "4xl": "1.75rem",
        "5xl": "2.25rem"
      },
      keyframes: {
        "fade-in": { from: { opacity: "0" }, to: { opacity: "1" } },
        "fade-in-up": { from: { opacity: "0", transform: "translateY(6px)" }, to: { opacity: "1", transform: "translateY(0)" } },
        "scale-in": { from: { opacity: "0", transform: "scale(0.96)" }, to: { opacity: "1", transform: "scale(1)" } },
        "slide-up": { from: { transform: "translateY(100%)" }, to: { transform: "translateY(0)" } },
        shimmer: { from: { backgroundPosition: "0% 0" }, to: { backgroundPosition: "-200% 0" } }
      },
      animation: {
        "fade-in": "fade-in 0.15s ease-out",
        "fade-in-up": "fade-in-up 0.2s ease-out",
        "scale-in": "scale-in 0.15s ease-out",
        "slide-up": "slide-up 0.25s cubic-bezier(0.32, 0.72, 0, 1)",
        shimmer: "shimmer 1.6s linear infinite"
      }
    }
  },
  plugins: []
};

export default config;
