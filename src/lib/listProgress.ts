import type { ChecklistItem, ChecklistSection, ChecklistSystem, CustomChecklistItem } from "../types";
import { itemsForSection } from "./customItems";
import { quickStartMinutes } from "./copy";

export type PrepLane = "vehicle" | "suitcase";

const LANE_KEY = "spl.prep-lane";

const SECTION_ORDER: Record<string, string[]> = {
  "grab-go": ["financial-id", "communication", "medical", "access", "documents", "survival"],
  "ready-bag": ["clothing", "hygiene", "medical", "food-water", "communications", "shelter-tools", "cooking", "documents"],
  "home-resilience": ["detection", "utilities", "lighting", "water", "food", "home-readiness", "comfort", "communications", "skills"],
};

const VEHICLE_PRIMARY_KEYS = [
  "vehicle.comfort.half-tank",
  "vehicle.safety.jumper-cables",
  "vehicle.safety.spare-tire",
  "vehicle.safety.tire-inflator",
  "vehicle.safety.gauge",
  "vehicle.comfort.lights",
  "vehicle.comfort.water",
  "vehicle.comfort.snacks",
  "vehicle.comfort.first-aid",
  "vehicle.comfort.gloves",
  "vehicle.comfort.shoes",
  "vehicle.comfort.charger",
  "vehicle.comfort.bank",
  "vehicle.comfort.maps",
  "vehicle.comfort.alt-route",
  "vehicle.safety.roadside",
  "vehicle.visibility.flares",
  "vehicle.visibility.vest",
];

export function readPrepLane(): PrepLane {
  try {
    return localStorage.getItem(LANE_KEY) === "suitcase" ? "suitcase" : "vehicle";
  } catch {
    return "vehicle";
  }
}

export function writePrepLane(lane: PrepLane) {
  localStorage.setItem(LANE_KEY, lane);
}

export function isTimedSystem(system: Pick<ChecklistSystem, "time_label"> | null | undefined) {
  return quickStartMinutes(system?.time_label) != null;
}

export function isPrimaryItem(item: ChecklistItem) {
  if (item.permanent_key.startsWith("custom.")) return false;
  return item.quick_start === true;
}

export function sectionsForSystem(
  sections: ChecklistSection[],
  system: Pick<ChecklistSystem, "id" | "slug">,
  lane: PrepLane | null,
) {
  const mine = sections.filter((section) => section.system_id === system.id);
  const order = SECTION_ORDER[system.slug];
  const ranked = [...mine].sort((a, b) => {
    const ai = order ? order.indexOf(a.slug) : -1;
    const bi = order ? order.indexOf(b.slug) : -1;
    const ar = ai === -1 ? 999 : ai;
    const br = bi === -1 ? 999 : bi;
    return ar - br || a.sort_order - b.sort_order;
  });
  if (system.slug !== "vehicle-suitcase" || !lane) return ranked;
  return ranked.filter((section) => section.lane === lane);
}

export function itemsOnSections(
  sections: ChecklistSection[],
  catalogItems: ChecklistItem[],
  customItems: CustomChecklistItem[],
) {
  return sections.flatMap((section) => itemsForSection(catalogItems, customItems, section.id));
}

export function trackedItems(
  system: ChecklistSystem,
  sections: ChecklistSection[],
  catalogItems: ChecklistItem[],
  customItems: CustomChecklistItem[],
  lane: PrepLane,
) {
  const chosen = sectionsForSystem(sections, system, system.slug === "vehicle-suitcase" ? lane : null);
  const items = itemsOnSections(chosen, catalogItems, customItems);
  return isTimedSystem(system) ? items.filter(isPrimaryItem) : items;
}

export function sortVehiclePrimary(items: ChecklistItem[]) {
  const rank = new Map(VEHICLE_PRIMARY_KEYS.map((key, index) => [key, index]));
  return [...items].sort(
    (a, b) => (rank.get(a.permanent_key) ?? 999) - (rank.get(b.permanent_key) ?? 999) || a.sort_order - b.sort_order,
  );
}
