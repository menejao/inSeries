import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "image.tmdb.org"
      }
    ],
    // Local placeholder poster/backdrop art (public/dev-media) ships as SVG for the seeded dev
    // catalog, since real TMDb photos require network access this sandbox doesn't have. The
    // generator is fully trusted (no user input), so a sandboxed CSP is enough to keep this safe.
    dangerouslyAllowSVG: true,
    contentSecurityPolicy: "default-src 'self'; script-src 'none'; sandbox;"
  }
};

export default nextConfig;
