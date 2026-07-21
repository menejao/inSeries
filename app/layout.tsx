import type { Metadata, Viewport } from "next";
import { Fraunces, Inter } from "next/font/google";
import "./globals.css";
import { AppShell } from "@/components/layout/app-shell";
import { PwaRegister } from "@/components/pwa-register";
import { ThemeProvider } from "@/components/theme/theme-provider";
import { ThemeScript } from "@/components/theme/theme-script";
import { ToastProvider } from "@/components/ui/toast";

/**
 * Fase 6/7 (INSERIES-PRODUCT-EXPERIENCE-REVOLUTION-01) — identidade tipografica: Fraunces
 * (serif editorial, mesma familia usada em `.section-title`/display) para dar carater
 * cinematografico aos titulos, Inter para todo o resto (UI densa — stats, tabelas, listas —
 * precisa de uma grotesca neutra e altamente legivel, nao da mesma serifa do display). Inter
 * ja estava listada como preferencia em tailwind.config.ts's `fontFamily.sans` mas nunca
 * carregada de verdade (so um nome solto no meio da stack de sistema) — self-hosted via
 * `next/font` (zero requisicao externa, sem layout shift), essa entrada passa a valer.
 */
const fraunces = Fraunces({ subsets: ["latin"], variable: "--font-display", display: "swap" });
const inter = Inter({ subsets: ["latin"], variable: "--font-sans", display: "swap" });

export const metadata: Metadata = {
  title: {
    default: "inSeries — acompanhe suas séries",
    template: "%s · inSeries"
  },
  description: "Acompanhe suas series, episodio por episodio.",
  applicationName: "inSeries",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "inSeries"
  },
  manifest: "/manifest.webmanifest"
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: dark)", color: "#090d16" },
    { media: "(prefers-color-scheme: light)", color: "#f6f7fb" }
  ],
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover"
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR" suppressHydrationWarning className={`${fraunces.variable} ${inter.variable}`}>
      <head>
        <ThemeScript />
      </head>
      <body>
        <ThemeProvider>
          <ToastProvider>
            <a href="#main-content" className="skip-link">
              Ir para o conteudo principal
            </a>
            <PwaRegister />
            <AppShell>{children}</AppShell>
          </ToastProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
