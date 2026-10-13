// Copies the checklist library into the checklist-library edge function.
// `node scripts/sync-catalog.mjs` writes the copy; `--check` fails the build when it is stale.
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const source = resolve(root, "src/data/catalog.json");
const tipsSource = resolve(root, "src/data/itemTips.ts");
const target = resolve(root, "supabase/functions/_shared/catalog.json");

const tips = Object.fromEntries(
  [...readFileSync(tipsSource, "utf8").matchAll(/^\s*"([^"]+)":\s*("(?:[^"\\]|\\.)*"),?\s*$/gm)].map((match) => [
    match[1],
    JSON.parse(match[2]),
  ]),
);
const { systems, sections, items } = JSON.parse(readFileSync(source, "utf8"));
const withTips = items.map((item) =>
  item.description?.trim() || !tips[item.permanent_key] ? item : { ...item, description: tips[item.permanent_key] },
);
const expected = `${JSON.stringify({ systems, sections, items: withTips })}\n`;

if (process.argv.includes("--check")) {
  let current = "";
  try {
    current = readFileSync(target, "utf8");
  } catch {
    current = "";
  }
  if (current !== expected) {
    console.error("supabase/functions/_shared/catalog.json is out of date. Run: node scripts/sync-catalog.mjs, then redeploy checklist-library.");
    process.exit(1);
  }
  console.log("Checklist library copy is current.");
} else {
  writeFileSync(target, expected);
  console.log(`Wrote ${target}`);
}
