import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const source = readFileSync(join(root, "src/lib/legal.ts"), "utf8");
const placeholders = [...source.matchAll(/"(\[[A-Za-z0-9 /,_.:'-]+\])"/g)].map((match) => match[1]);
const unique = [...new Set(placeholders)];

if (unique.length) {
  console.error("Legal placeholders remain in src/lib/legal.ts. Fill these before a production build:");
  for (const value of unique) console.error(`  - ${value}`);
  process.exit(1);
}
