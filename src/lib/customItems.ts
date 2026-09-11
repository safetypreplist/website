import type { ChecklistItem, ChecklistSection, CustomChecklistItem } from "../types";

export const INCLUDED_CUSTOM_PER_SECTION = 5;
export const ITEM_LIMIT_ERROR = "ITEM_LIMIT_REACHED";

export function customItemCap(_bonus?: number | null) {
  return INCLUDED_CUSTOM_PER_SECTION;
}

export function asChecklistItem(item: CustomChecklistItem): ChecklistItem {
  return {
    id: item.id,
    section_id: item.section_id,
    permanent_key: `custom.${item.id}`,
    text: item.text,
    description: item.description,
    sort_order: 100000 + item.sort_order,
    active: true,
  };
}

export function itemsForSection(
  catalogItems: ChecklistItem[],
  customItems: CustomChecklistItem[],
  sectionId: string,
) {
  const catalog = catalogItems
    .filter((item) => item.section_id === sectionId)
    .sort((a, b) => a.sort_order - b.sort_order);
  const custom = customItems
    .filter((item) => item.section_id === sectionId)
    .sort((a, b) => a.sort_order - b.sort_order)
    .map(asChecklistItem);
  return [...catalog, ...custom];
}

export function itemsForSections(
  catalogItems: ChecklistItem[],
  customItems: CustomChecklistItem[],
  sections: ChecklistSection[],
) {
  const sectionIds = new Set(sections.map((section) => section.id));
  const catalog = catalogItems.filter((item) => sectionIds.has(item.section_id));
  const custom = customItems.filter((item) => sectionIds.has(item.section_id)).map(asChecklistItem);
  return [...catalog, ...custom];
}

export function customCountInSection(customItems: CustomChecklistItem[], sectionId: string) {
  return customItems.filter((item) => item.section_id === sectionId).length;
}
