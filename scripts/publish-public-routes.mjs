// GitHub Pages returns HTTP 404 for deep links unless a real file exists at that path.
// Copy the built SPA shell into known public route folders so those URLs return 200.
import { copyFileSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const index = resolve(root, "dist/index.html");
const routes = [
  "launch26",
  "privacy",
  "terms",
  "contact",
  "install",
  "demo",
  "signin",
  "create-account",
  "join",
  "checkout",
  "thank-you",
  "reset-password",
  "update-password",
  "pricing",
  "support",
  "refunds",
];

for (const route of routes) {
  const dir = resolve(root, "dist", route);
  mkdirSync(dir, { recursive: true });
  copyFileSync(index, resolve(dir, "index.html"));
}
