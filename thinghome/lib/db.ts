import { promises as fs } from "fs";
import path from "path";
import { deleteImage } from "./storage";
import type { Item, ItemInput } from "./types";

const DATA_DIR = path.join(process.cwd(), "data");
const DATA_FILE = path.join(DATA_DIR, "items.json");

type RawItem = Item & { imagePath?: string | null };

function normalizeItem(raw: RawItem): Item {
  let imagePaths: string[] = [];
  if (Array.isArray(raw.imagePaths)) {
    imagePaths = raw.imagePaths.filter(Boolean);
  } else if (raw.imagePath) {
    imagePaths = [raw.imagePath];
  }

  return {
    id: raw.id,
    name: raw.name,
    categoryId: raw.categoryId ?? null,
    location: raw.location ?? null,
    purchaseDate: raw.purchaseDate ?? null,
    expiryDate: raw.expiryDate ?? null,
    shelfLifeDays: raw.shelfLifeDays ?? null,
    quantity: raw.quantity ?? 1,
    remaining: raw.remaining ?? raw.quantity ?? 1,
    price: raw.price ?? null,
    unit: raw.unit ?? null,
    notes: raw.notes ?? null,
    imagePaths,
    source: raw.source ?? "manual",
    batchId: raw.batchId ?? null,
    createdAt: raw.createdAt,
    updatedAt: raw.updatedAt,
  };
}

async function ensureDataFile() {
  await fs.mkdir(DATA_DIR, { recursive: true });
  try {
    await fs.access(DATA_FILE);
  } catch {
    await fs.writeFile(DATA_FILE, "[]", "utf-8");
  }
}

async function readItems(): Promise<Item[]> {
  await ensureDataFile();
  const raw = await fs.readFile(DATA_FILE, "utf-8");
  const items = JSON.parse(raw) as RawItem[];
  return items.map(normalizeItem);
}

async function writeItems(items: Item[]) {
  await ensureDataFile();
  await fs.writeFile(DATA_FILE, JSON.stringify(items, null, 2), "utf-8");
}

export async function listItems(): Promise<Item[]> {
  const items = await readItems();
  return items.sort(
    (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
  );
}

export async function getItem(id: string): Promise<Item | null> {
  const items = await readItems();
  return items.find((item) => item.id === id) ?? null;
}

export async function createItem(input: ItemInput): Promise<Item> {
  const items = await readItems();
  const now = new Date().toISOString();

  const item: Item = {
    id: crypto.randomUUID(),
    name: input.name.trim(),
    categoryId: input.categoryId ?? null,
    location: input.location?.trim() || null,
    purchaseDate: input.purchaseDate ?? null,
    expiryDate: input.expiryDate ?? null,
    shelfLifeDays: input.shelfLifeDays ?? null,
    quantity: input.quantity ?? 1,
    remaining: input.remaining ?? input.quantity ?? 1,
    price: input.price ?? null,
    unit: input.unit ?? null,
    notes: input.notes ?? null,
    imagePaths: input.imagePaths ?? [],
    source: input.source ?? "manual",
    batchId: input.batchId ?? null,
    createdAt: now,
    updatedAt: now,
  };

  items.push(item);
  await writeItems(items);
  return item;
}

export async function updateItem(
  id: string,
  input: Partial<ItemInput>,
): Promise<Item | null> {
  const items = await readItems();
  const index = items.findIndex((item) => item.id === id);
  if (index === -1) return null;

  const current = items[index];
  const nextImagePaths =
    input.imagePaths !== undefined ? input.imagePaths : current.imagePaths;

  const removedPaths = current.imagePaths.filter(
    (path) => !nextImagePaths.includes(path),
  );
  for (const filename of removedPaths) {
    await deleteImage(filename);
  }

  const updated: Item = {
    ...current,
    ...input,
    name: input.name !== undefined ? input.name.trim() : current.name,
    location:
      input.location !== undefined
        ? input.location?.trim() || null
        : current.location,
    imagePaths: nextImagePaths,
    updatedAt: new Date().toISOString(),
  };

  items[index] = updated;
  await writeItems(items);
  return updated;
}

export async function unlinkCategoryFromItems(
  categoryId: string,
): Promise<void> {
  const items = await readItems();
  let changed = false;

  const updated = items.map((item) => {
    if (item.categoryId !== categoryId) return item;
    changed = true;
    return {
      ...item,
      categoryId: null,
      updatedAt: new Date().toISOString(),
    };
  });

  if (changed) await writeItems(updated);
}

export async function deleteItem(id: string): Promise<boolean> {
  const items = await readItems();
  const target = items.find((item) => item.id === id);
  if (!target) return false;

  for (const filename of target.imagePaths) {
    await deleteImage(filename);
  }
  await writeItems(items.filter((item) => item.id !== id));
  return true;
}
