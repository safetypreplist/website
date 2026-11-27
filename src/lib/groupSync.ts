// Two-way merge between this device's checklist and its shared copy in an active Group Sharing group.
// The newer side wins for each item; rows that already match are left alone.

export type LocalRow = { checked: boolean; note: string; updated_at: string };
export type RemoteRow = { checklist_item_id: string; checked: boolean; note: string; updated_at: string };

export type OwnSyncPlan = {
  toLocal: Array<{ itemId: string; checked: boolean; note: string; updatedAt: string }>;
  toRemote: Array<{ checklistItemId: string; checked: boolean; note: string }>;
};

function time(value: string | null | undefined) {
  const parsed = Date.parse(value || "");
  return Number.isFinite(parsed) ? parsed : 0;
}

function blank(row: { checked: boolean; note: string } | undefined) {
  return !row || (!row.checked && !(row.note || "").trim());
}

export function planOwnSync(local: Record<string, LocalRow | undefined>, remote: RemoteRow[]): OwnSyncPlan {
  const plan: OwnSyncPlan = { toLocal: [], toRemote: [] };
  const remoteById = new Map(remote.map((row) => [row.checklist_item_id, row]));
  const ids = new Set([...Object.keys(local), ...remoteById.keys()]);
  for (const id of ids) {
    const l = local[id];
    const r = remoteById.get(id);
    if (l && r && l.checked === r.checked && (l.note || "") === (r.note || "")) continue;
    if (!r && blank(l)) continue;
    if (!l && blank(r)) continue;
    if (r && (!l || time(r.updated_at) > time(l.updated_at))) {
      plan.toLocal.push({ itemId: id, checked: r.checked, note: r.note || "", updatedAt: r.updated_at });
    } else if (l) {
      plan.toRemote.push({ checklistItemId: id, checked: l.checked, note: l.note || "" });
    }
  }
  return plan;
}

export function customItemsSignature(
  items: Array<{ id: string; section_id: string; text: string; description: string | null; sort_order: number }>,
) {
  return items
    .map((item) => [item.id, item.section_id, item.text, item.description || "", item.sort_order].join("\u0001"))
    .sort()
    .join("\u0002");
}
