import type { NextConfig } from "next";

// Static demo build (GitHub Pages): plain HTML, no server, mock data in the browser.
// Run it with `npm run build:static` (see scripts/build-static.mjs).
const isStaticDemo = process.env.NEXT_PUBLIC_STATIC_DEMO === "true";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  ...(isStaticDemo && {
    output: "export",
    trailingSlash: true,
    images: { unoptimized: true },
    basePath: process.env.NEXT_PUBLIC_BASE_PATH || undefined
  })
};

export default nextConfig;
