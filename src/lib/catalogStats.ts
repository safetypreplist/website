import catalog from "../data/catalog.json";
import type { ChecklistItem, ChecklistSection, ChecklistSystem } from "../types";

const systems = catalog.systems as ChecklistSystem[];
const sections = catalog.sections as ChecklistSection[];
const items = (catalog.items as ChecklistItem[]).filter((item) => item.active !== false);

function itemsForSystem(systemId: string) {
  const sectionIds = new Set(sections.filter((section) => section.system_id === systemId).map((section) => section.id));
  return items.filter((item) => sectionIds.has(item.section_id));
}

export function coreSystems() {
  return systems.filter((system) => system.access_tier === "core").sort((a, b) => a.sort_order - b.sort_order);
}

export function vaultSystems() {
  return systems.filter((system) => system.access_tier === "full").sort((a, b) => a.sort_order - b.sort_order);
}

export function vaultItemCount() {
  return vaultSystems().reduce((total, system) => total + itemsForSystem(system.id).length, 0);
}
