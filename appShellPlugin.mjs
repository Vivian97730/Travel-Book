import { createHash } from "node:crypto";
import { copyFileSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

export function appShellPlugin() {
  return {
    name: "travel-book-app-shell",
    apply: "build",
    writeBundle({ dir }) {
      const icons = ["app-icon-192.png", "app-icon-512.png", "apple-touch-icon.png", "favicon-32.png"]
        .map((name) => "icons/" + name);
      mkdirSync(join(dir, "icons"), { recursive: true });
      for (const icon of icons) {
        copyFileSync(new URL("./dist/" + icon, import.meta.url), join(dir, icon));
      }
      const assets = ["index.html", "manifest.webmanifest", ...icons,
        ...readdirSync(join(dir, "assets")).sort().map((name) => "assets/" + name)];
      const hash = createHash("sha256");
      const worker = readFileSync(new URL("./src/features/offline/appShellWorker.js", import.meta.url), "utf8");
      for (const asset of assets) hash.update(readFileSync(join(dir, asset)));
      const cachePrefix = "travel-book-formal:" + this.environment.config.base + ":";
      const cacheName = cachePrefix + hash.update(worker).digest("hex").slice(0, 16);
      const config = { assets, cacheName, cachePrefix };
      // Output includes the generated HTML, so write the worker after Rollup writes the bundle.
      writeFileSync(join(dir, "app-shell-worker.js"), worker.replace("/* __APP_SHELL_CONFIG__ */",
        Object.entries(config).map(([name, value]) => `const ${name} = ${JSON.stringify(value)};`).join("\n")));
    },
  };
}
