import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";

const manifestUrl = new URL("../tests/visual/prototype-baseline.json", import.meta.url);
const manifest = JSON.parse(await readFile(manifestUrl, "utf8"));
const mismatches = [];

for (const [path, expected] of Object.entries(manifest)) {
  const fileUrl = new URL(`../${path}`, import.meta.url);
  const actual = createHash("sha256").update(await readFile(fileUrl)).digest("hex");
  if (actual !== expected) mismatches.push(`${path}: expected ${expected}, received ${actual}`);
}

if (mismatches.length) {
  console.error("Prototype baseline changed without an approved baseline update:");
  console.error(mismatches.join("\n"));
  process.exitCode = 1;
} else {
  console.log(`Prototype baseline verified (${Object.keys(manifest).length} files).`);
}
