import { promises as fs } from "fs";
import path from "path";
import { unlinkCategoryFromItems } from "./db";
import type { Category, CategoryInput } from "./types";

const DATA_DIR = path.join(process.cwd(), "data");
const DATA_FILE = path.join(DATA_DIR, "categories.json");

const DEFAULT_CATEGORIES = ["書籍", "生活用品", "廁所", "房間", "食物"];

async function ensureDataFile() {
  await fs.mkdir(DATA_DIR, { recursive: true });
  try {
    await fs.access(DATA_FILE);
  } catch {
    const now = new Date().toISOString();
    const categories: Category[] = DEFAULT_CATEGORIES.map((name) => ({
      id: crypto.randomUUID(),
      name,
      createdAt: now,
      updatedAt: now,
    }));
    await fs.writeFile(DATA_FILE, JSON.stringify(categories, null, 2), "utf-8");
  }
}

async function readCategories(): Promise<Category[]> {
  await ensureDataFile();
  const raw = await fs.readFile(DATA_FILE, "utf-8");
  return JSON.parse(raw) as Category[];
}

async function writeCategories(categories: Category[]) {
  await ensureDataFile();
  await fs.writeFile(DATA_FILE, JSON.stringify(categories, null, 2), "utf-8");
}

export async function listCategories(): Promise<Category[]> {
  const categories = await readCategories();
  return categories.sort((a, b) => a.name.localeCompare(b.name, "zh-Hant"));
}

export async function getCategory(id: string): Promise<Category | null> {
  const categories = await readCategories();
  return categories.find((category) => category.id === id) ?? null;
}

export async function createCategory(input: CategoryInput): Promise<Category> {
  const categories = await readCategories();
  const now = new Date().toISOString();

  const category: Category = {
    id: crypto.randomUUID(),
    name: input.name.trim(),
    createdAt: now,
    updatedAt: now,
  };

  categories.push(category);
  await writeCategories(categories);
  return category;
}

export async function updateCategory(
  id: string,
  input: Partial<CategoryInput>,
): Promise<Category | null> {
  const categories = await readCategories();
  const index = categories.findIndex((category) => category.id === id);
  if (index === -1) return null;

  const current = categories[index];
  const updated: Category = {
    ...current,
    name: input.name !== undefined ? input.name.trim() : current.name,
    updatedAt: new Date().toISOString(),
  };

  categories[index] = updated;
  await writeCategories(categories);
  return updated;
}

export async function deleteCategory(id: string): Promise<boolean> {
  const categories = await readCategories();
  const target = categories.find((category) => category.id === id);
  if (!target) return false;

  await unlinkCategoryFromItems(id);
  await writeCategories(categories.filter((category) => category.id !== id));
  return true;
}
