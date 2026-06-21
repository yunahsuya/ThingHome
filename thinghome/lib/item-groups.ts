import type { Item } from "./types";

export type ItemDisplayUnit =
  | { kind: "single"; item: Item }
  | { kind: "batch"; batchId: string; items: Item[] };

function unitUpdatedAt(unit: ItemDisplayUnit): number {
  if (unit.kind === "single") {
    return new Date(unit.item.updatedAt).getTime();
  }
  return Math.max(...unit.items.map((item) => new Date(item.updatedAt).getTime()));
}

export function buildItemDisplayUnits(items: Item[]): ItemDisplayUnit[] {
  const batchMap = new Map<string, Item[]>();
  const standalone: Item[] = [];
  const legacyMap = new Map<string, Item[]>();

  for (const item of items) {
    if (item.batchId) {
      const group = batchMap.get(item.batchId) ?? [];
      group.push(item);
      batchMap.set(item.batchId, group);
      continue;
    }

    const legacyKey = item.createdAt.slice(0, 19);
    const legacyGroup = legacyMap.get(legacyKey) ?? [];
    legacyGroup.push(item);
    legacyMap.set(legacyKey, legacyGroup);
  }

  const legacyBatchIds = new Set<string>();
  for (const [legacyKey, legacyItems] of legacyMap) {
    if (legacyItems.length > 1) {
      batchMap.set(`legacy:${legacyKey}`, legacyItems);
      legacyBatchIds.add(legacyKey);
    }
  }

  for (const item of items) {
    if (item.batchId) continue;
    const legacyKey = item.createdAt.slice(0, 19);
    if (legacyBatchIds.has(legacyKey)) continue;
    standalone.push(item);
  }

  const units: ItemDisplayUnit[] = standalone.map((item) => ({
    kind: "single",
    item,
  }));

  for (const [batchId, batchItems] of batchMap) {
    if (batchItems.length > 1) {
      units.push({
        kind: "batch",
        batchId,
        items: batchItems.sort(
          (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
        ),
      });
    } else {
      units.push({ kind: "single", item: batchItems[0] });
    }
  }

  return units.sort((a, b) => unitUpdatedAt(b) - unitUpdatedAt(a));
}

export function formatBatchLabel(items: Item[]): string {
  const date = items[0]?.createdAt;
  if (!date) return `${items.length} 項商品`;
  const formatted = date.slice(0, 10).replace(/-/g, "/");
  return `${items.length} 項 · ${formatted}`;
}
