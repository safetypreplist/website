// License model: full checklist catalog ships in the app bundle after activation.
// This check now only ensures the public *sample* file still exists and logs catalog size.
import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const samplePath = resolve(root, "src/lib/sampleChecklist.ts");
const catalogPath = resolve(root, "src/data/catalog.json");

if (!existsSync(samplePath)) {
  console.error("Missing public sample checklist at src/lib/sampleChecklist.ts");
  process.exit(1);
}
if (!existsSync(catalogPath)) {
  console.error("Missing catalog at src/data/catalog.json");
  process.exit(1);
}

const { items } = JSON.parse(readFileSync(catalogPath, "utf8"));
console.log(
  `Bundle check (license model): catalog has ${items.length} items; content is allowed in the app bundle.`,
);
