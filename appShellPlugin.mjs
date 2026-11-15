import { createHash } from "node:crypto";
import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

export function appShellPlugin() {
  return {
    name: "travel-book-app-shell",
    apply: "build",
    writeBundle({ dir }) {
      const assets = ["index.html", ...readdirSync(join(dir, "assets")).sort().map((name) => "assets/" + name)];
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
