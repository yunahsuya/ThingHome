import { promises as fs } from "fs";
import path from "path";
import { deleteImage } from "./storage";
import type { Item, ItemInput } from "./types";

const DATA_DIR = path.join(process.cwd(), "data");
const DATA_FILE = path.join(DATA_DIR, "items.json");

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
  return JSON.parse(raw) as Item[];
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
    purchaseDate: input.purchaseDate ?? null,
    expiryDate: input.expiryDate ?? null,
    shelfLifeDays: input.shelfLifeDays ?? null,
    quantity: input.quantity ?? 1,
    remaining: input.remaining ?? input.quantity ?? 1,
    price: input.price ?? null,
    unit: input.unit ?? null,
    notes: input.notes ?? null,
    imagePath: input.imagePath ?? null,
    source: input.source ?? "manual",
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
  const updated: Item = {
    ...current,
    ...input,
    name: input.name !== undefined ? input.name.trim() : current.name,
    imagePath:
      input.imagePath !== undefined ? input.imagePath : current.imagePath,
    updatedAt: new Date().toISOString(),
  };

  if (
    input.imagePath !== undefined &&
    current.imagePath &&
    current.imagePath !== input.imagePath
  ) {
    await deleteImage(current.imagePath);
  }

  items[index] = updated;
  await writeItems(items);
  return updated;
}

export async function deleteItem(id: string): Promise<boolean> {
  const items = await readItems();
  const target = items.find((item) => item.id === id);
  if (!target) return false;

  await deleteImage(target.imagePath);
  await writeItems(items.filter((item) => item.id !== id));
  return true;
}
