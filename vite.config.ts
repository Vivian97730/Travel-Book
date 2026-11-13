import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

import { appShellPlugin } from "./appShellPlugin.mjs";

export default defineConfig({
  base: "/Travel-Book/",
  plugins: [react(), appShellPlugin()],
  build: {
    outDir: "build",
    emptyOutDir: true,
  },
  test: {
    environment: "node",
  },
});
