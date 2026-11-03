import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

export default defineConfig({
  base: "/Travel-Book/",
  plugins: [react()],
  build: {
    outDir: "build",
    emptyOutDir: true,
  },
  test: {
    environment: "node",
  },
});
