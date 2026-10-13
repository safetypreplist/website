// Fails the build if paid checklist content ends up in the public site bundle.
// Text that also appears in the public sample checklist is allowed.
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const dist = resolve(root, "dist");
const samplePath = resolve(root, "src/lib/sampleChecklist.ts");
const sample = existsSync(samplePath) ? readFileSync(samplePath, "utf8") : "";
const { items } = JSON.parse(readFileSync(resolve(root, "supabase/functions/_shared/catalog.json"), "utf8"));

const needles = new Set();
for (const item of items) {
  for (const value of [item.text, item.description]) {
    const text = typeof value === "string" ? value.trim() : "";
    if (text.length >= 24 && !sample.includes(text)) needles.add(text);
  }
}

function files(dir) {
  // Files named __* in public/ are local, uncommitted previews.
  return readdirSync(dir).filter((name) => !name.startsWith("__")).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? files(path) : [path];
  });
}

const leaks = [];
for (const file of files(dist).filter((path) => /\.(js|html|json|webmanifest|txt)$/.test(path))) {
  const body = readFileSync(file, "utf8");
  for (const text of needles) {
    if (body.includes(text) || body.includes(JSON.stringify(text).slice(1, -1))) {
      leaks.push(`${file.replace(`${root}/`, "")}: ${text.slice(0, 60)}`);
      if (leaks.length > 10) break;
    }
  }
}

if (leaks.length) {
  console.error("Paid checklist content found in the public bundle:\n" + leaks.join("\n"));
  process.exit(1);
}
console.log(`Bundle check passed (${needles.size} checklist strings not present).`);
