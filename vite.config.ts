import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import type { Plugin, ResolvedConfig } from "vite";

import { appShellPlugin } from "./appShellPlugin.mjs";

function webOrigin(value: string | undefined): string[] {
  if (!value?.trim()) return [];
  const url = new URL(value.trim());
  if (url.protocol !== "https:" && url.protocol !== "http:") return [];
  return [url.origin];
}

function releaseSecurity(): Plugin {
  let config: ResolvedConfig;
  return {
    name: "travel-book-release-security",
    apply: "build",
    configResolved(resolved) {
      config = resolved;
    },
    transformIndexHtml() {
      const connect = ["'self'", "https://api.open-meteo.com", "https://api.bigdatacloud.net",
        ...webOrigin(config.env.VITE_API_BASE_URL)];
      const images = ["'self'", "data:", "blob:", "https://tile.openstreetmap.org",
        ...webOrigin(config.env.VITE_MAP_TILE_URL?.replace("{s}.", "*."))];
      const policy = [
        "default-src 'none'",
        "base-uri 'none'",
        "form-action 'none'",
        "script-src 'self'",
        "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
        "font-src 'self' https://fonts.gstatic.com",
        "worker-src 'self'",
        "manifest-src 'self'",
        "connect-src " + connect.join(" "),
        "img-src " + images.join(" "),
      ];
      return [
        { tag: "meta", attrs: { "http-equiv": "Content-Security-Policy", content: policy.join("; ") }, injectTo: "head-prepend" },
        { tag: "meta", attrs: { name: "referrer", content: "strict-origin" }, injectTo: "head-prepend" },
      ];
    },
  };
}

export default defineConfig({
  base: "/Travel-Book/",
  plugins: [react(), appShellPlugin(), releaseSecurity()],
  build: {
    outDir: "build",
    emptyOutDir: true,
  },
  test: {
    environment: "node",
  },
});
