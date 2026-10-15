export const MAX_CHECKLIST_QUANTITY = 20;

/** Whole number of checklists from 1 to MAX_CHECKLIST_QUANTITY, or null if the value is not allowed. */
export function parseQuantity(raw: unknown): number | null {
  if (typeof raw === "boolean" || raw === "" || raw == null) return null;
  const n = typeof raw === "number" ? raw : Number(raw);
  if (!Number.isInteger(n) || n < 1 || n > MAX_CHECKLIST_QUANTITY) return null;
  return n;
}
