import type { ChecklistItem, ChecklistSection, ChecklistSystem, SafetyContact } from "../types";
import catalog from "../data/catalog.json";
import { infoForItem } from "../data/itemTips";

export type CatalogBundle = {
  systems: ChecklistSystem[];
  sections: ChecklistSection[];
  items: ChecklistItem[];
  safety: SafetyContact[];
};

type RawCatalog = {
  systems: ChecklistSystem[];
  sections: ChecklistSection[];
  items: Array<ChecklistItem & { description?: string | null }>;
  safety?: SafetyContact[];
};

/** Static catalog + tip merge. Replaces the auth-gated checklist-library Edge Function. */
export function loadCatalog(): CatalogBundle {
  const raw = catalog as RawCatalog;
  const systems = (raw.systems || []).filter((row) => row.active !== false);
  const sections = raw.sections || [];
  const items = (raw.items || [])
    .filter((row) => row.active !== false)
    .map((row) => {
      const tip = infoForItem(row.permanent_key);
      return {
        ...row,
        description: row.description || tip || null,
      };
    });
  const safety = (raw.safety || []).filter((row) => row.active !== false);
  return { systems, sections, items, safety };
}
