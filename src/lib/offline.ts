const QUEUE_KEY = "spl.offline.progress.v1";

export type QueuedProgress = {
  itemId: string;
  checked: boolean;
  note: string;
  deviceId: string | null;
  queuedAt: string;
};

export function readQueue(): QueuedProgress[] {
  try {
    return JSON.parse(localStorage.getItem(QUEUE_KEY) || "[]") as QueuedProgress[];
  } catch {
    return [];
  }
}

export function enqueueProgress(row: Omit<QueuedProgress, "queuedAt">) {
  const queue = readQueue().filter((item) => item.itemId !== row.itemId);
  queue.push({ ...row, queuedAt: new Date().toISOString() });
  localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
}

export function clearQueueItem(itemId: string) {
  const queue = readQueue().filter((item) => item.itemId !== itemId);
  localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
}

export function remapQueue(ids: Map<string, string>) {
  const queue = readQueue();
  if (!queue.some((item) => ids.has(item.itemId))) return;
  const next = new Map<string, QueuedProgress>();
  for (const item of queue) {
    const itemId = ids.get(item.itemId) || item.itemId;
    next.set(itemId, { ...item, itemId });
  }
  localStorage.setItem(QUEUE_KEY, JSON.stringify([...next.values()]));
}

export function clearQueue() {
  localStorage.removeItem(QUEUE_KEY);
}

export function isOnline() {
  return navigator.onLine;
}
