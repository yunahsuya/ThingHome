import type { Item } from "./types";

export function normalizeSearchQuery(query: string): string {
  return query.trim().toLowerCase();
}

export function itemMatchesSearch(
  item: Item,
  query: string,
  categoryName?: string | null,
): boolean {
  const normalized = normalizeSearchQuery(query);
  if (!normalized) return true;

  const fields = [
    item.name,
    item.location,
    item.notes,
    item.unit,
    categoryName,
    item.price !== null ? String(item.price) : null,
    item.purchaseDate,
    item.expiryDate,
  ];

  return fields.some(
    (value) => value && value.toLowerCase().includes(normalized),
  );
}

export function filterItemsBySearch(
  items: Item[],
  query: string,
  categoryMap: Map<string, string>,
): Item[] {
  const normalized = normalizeSearchQuery(query);
  if (!normalized) return items;

  return items.filter((item) =>
    itemMatchesSearch(
      item,
      normalized,
      item.categoryId ? categoryMap.get(item.categoryId) : null,
    ),
  );
}
