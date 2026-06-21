"use client";

import { BASE_PATH } from "@/lib/site";
import {
  applyBackup,
  buildBackup,
  downloadBackupFile,
  getBackupSnapshot,
  getLastBackupAt,
  parseBackupFile,
  saveBackupSnapshot,
  scheduleBackupSnapshot,
  type ThingHomeBackup,
} from "@/lib/backup";
import {
  disconnectSyncFolder,
  getFolderSyncInfo,
  getLocalDataTimestamp,
  isFolderSyncSupported,
  pickSyncFolder,
  scheduleFolderSync,
  syncWithBoundFolder,
  type FolderSyncInfo,
  type FolderSyncResult,
} from "@/lib/folder-sync";
import { parseProductText } from "@/lib/parse-text";
import type {
  Category,
  CategoryInput,
  Item,
  ItemInput,
  ParsedItemDraft,
} from "@/lib/types";

const ITEMS_KEY = "thinghome:items";
const CATEGORIES_KEY = "thinghome:categories";
const LEGACY_MIGRATION_KEY = "thinghome:legacy-migrated-v1";
const IMAGE_DB = "thinghome-images";
const IMAGE_STORE = "images";

const DEFAULT_CATEGORIES = ["書籍", "生活用品", "廁所", "房間", "食物"];
const ALLOWED_EXT = new Set([".jpg", ".jpeg", ".png", ".webp", ".gif"]);
const MAX_BYTES = 10 * 1024 * 1024;

const imageUrlCache = new Map<string, string>();

function readJson<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function writeJson<T>(key: string, value: T) {
  localStorage.setItem(key, JSON.stringify(value));
}

function readAllItems(): Item[] {
  return readJson<Item[]>(ITEMS_KEY, []);
}

function writeAllItems(items: Item[]) {
  writeJson(ITEMS_KEY, items);
}

function readAllCategories(): Category[] {
  return readJson<Category[]>(CATEGORIES_KEY, []);
}

function writeAllCategories(categories: Category[]) {
  writeJson(CATEGORIES_KEY, categories);
}

async function buildCurrentBackup(): Promise<ThingHomeBackup> {
  return buildBackup(
    readAllItems(),
    readAllCategories(),
    getImageBlob,
  );
}

async function runFolderSync(): Promise<FolderSyncResult> {
  const items = readAllItems();
  const categories = readAllCategories();
  const localBackup = await buildCurrentBackup();

  const result = await syncWithBoundFolder({
    localBackup,
    localTimestamp: getLocalDataTimestamp(items, categories),
    applyRemote: async (backup) => {
      await applyBackup(
        backup,
        "replace",
        readAllItems,
        writeAllItems,
        readAllCategories,
        writeAllCategories,
        saveImageBlob,
      );
    },
  });

  if (result.action === "pushed" && result.localAt) {
    saveBackupSnapshot({ ...localBackup, exportedAt: result.localAt });
  }

  return result;
}

function notifyDataChanged() {
  scheduleBackupSnapshot(buildCurrentBackup);
  scheduleFolderSync(runFolderSync);
}

function ensureDefaultCategories() {
  const existing = readJson<Category[]>(CATEGORIES_KEY, []);
  if (existing.length > 0) return;

  const now = new Date().toISOString();
  const categories: Category[] = DEFAULT_CATEGORIES.map((name) => ({
    id: crypto.randomUUID(),
    name,
    createdAt: now,
    updatedAt: now,
  }));
  writeJson(CATEGORIES_KEY, categories);
}

function openImageDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(IMAGE_DB, 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(IMAGE_STORE)) {
        db.createObjectStore(IMAGE_STORE);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("IndexedDB open failed"));
  });
}

async function saveImageBlob(filename: string, blob: Blob) {
  const db = await openImageDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(IMAGE_STORE, "readwrite");
    tx.objectStore(IMAGE_STORE).put(blob, filename);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error("IndexedDB write failed"));
  });
  db.close();
}

async function deleteImageBlob(filename: string) {
  const db = await openImageDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(IMAGE_STORE, "readwrite");
    tx.objectStore(IMAGE_STORE).delete(filename);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error("IndexedDB delete failed"));
  });
  db.close();
}

async function getImageBlob(filename: string): Promise<Blob | null> {
  const db = await openImageDb();
  const blob = await new Promise<Blob | null>((resolve, reject) => {
    const tx = db.transaction(IMAGE_STORE, "readonly");
    const request = tx.objectStore(IMAGE_STORE).get(filename);
    request.onsuccess = () => resolve((request.result as Blob | undefined) ?? null);
    request.onerror = () => reject(request.error ?? new Error("IndexedDB read failed"));
  });
  db.close();
  return blob;
}

function revokeImageUrl(filename: string) {
  const cached = imageUrlCache.get(filename);
  if (cached) {
    URL.revokeObjectURL(cached);
    imageUrlCache.delete(filename);
  }
}

export async function listItems(): Promise<Item[]> {
  const items = readJson<Item[]>(ITEMS_KEY, []);
  return items.sort(
    (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
  );
}

export async function createItem(input: ItemInput): Promise<Item> {
  const items = readJson<Item[]>(ITEMS_KEY, []);
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
  writeAllItems(items);
  notifyDataChanged();
  return item;
}

export async function updateItem(
  id: string,
  input: Partial<ItemInput> & { imagePaths?: string[] },
): Promise<Item | null> {
  const items = readJson<Item[]>(ITEMS_KEY, []);
  const index = items.findIndex((item) => item.id === id);
  if (index === -1) return null;

  const current = items[index];
  const nextImagePaths =
    input.imagePaths !== undefined ? input.imagePaths : current.imagePaths;

  for (const filename of current.imagePaths) {
    if (!nextImagePaths.includes(filename)) {
      revokeImageUrl(filename);
      await deleteImageBlob(filename);
    }
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
  writeAllItems(items);
  notifyDataChanged();
  return updated;
}

export async function deleteItem(id: string): Promise<boolean> {
  const items = readJson<Item[]>(ITEMS_KEY, []);
  const target = items.find((item) => item.id === id);
  if (!target) return false;

  for (const filename of target.imagePaths) {
    revokeImageUrl(filename);
    await deleteImageBlob(filename);
  }

  writeAllItems(items.filter((item) => item.id !== id));
  notifyDataChanged();
  return true;
}

export async function listCategories(): Promise<Category[]> {
  ensureDefaultCategories();
  const categories = readJson<Category[]>(CATEGORIES_KEY, []);
  return categories.sort((a, b) => a.name.localeCompare(b.name, "zh-Hant"));
}

export async function createCategory(input: CategoryInput): Promise<Category> {
  ensureDefaultCategories();
  const categories = readJson<Category[]>(CATEGORIES_KEY, []);
  const now = new Date().toISOString();

  const category: Category = {
    id: crypto.randomUUID(),
    name: input.name.trim(),
    createdAt: now,
    updatedAt: now,
  };

  categories.push(category);
  writeAllCategories(categories);
  notifyDataChanged();
  return category;
}

export async function updateCategory(
  id: string,
  input: Partial<CategoryInput>,
): Promise<Category | null> {
  const categories = readJson<Category[]>(CATEGORIES_KEY, []);
  const index = categories.findIndex((category) => category.id === id);
  if (index === -1) return null;

  const current = categories[index];
  const updated: Category = {
    ...current,
    name: input.name !== undefined ? input.name.trim() : current.name,
    updatedAt: new Date().toISOString(),
  };

  categories[index] = updated;
  writeAllCategories(categories);
  notifyDataChanged();
  return updated;
}

export async function deleteCategory(id: string): Promise<boolean> {
  const categories = readJson<Category[]>(CATEGORIES_KEY, []);
  const target = categories.find((category) => category.id === id);
  if (!target) return false;

  const items = readJson<Item[]>(ITEMS_KEY, []);
  const updatedItems = items.map((item) =>
    item.categoryId === id
      ? { ...item, categoryId: null, updatedAt: new Date().toISOString() }
      : item,
  );
  writeAllItems(updatedItems);
  writeAllCategories(categories.filter((category) => category.id !== id));
  notifyDataChanged();
  return true;
}

export function parseText(text: string): ParsedItemDraft {
  return parseProductText(text);
}

export async function uploadImageFile(file: File): Promise<string> {
  const ext = file.name.slice(file.name.lastIndexOf(".")).toLowerCase();
  if (!ALLOWED_EXT.has(ext)) {
    throw new Error("不支援的圖片格式");
  }
  if (file.size > MAX_BYTES) {
    throw new Error("圖片太大（上限 10 MB）");
  }

  const normalizedExt = ext === ".jpeg" ? ".jpg" : ext;
  const filename = `${crypto.randomUUID()}${normalizedExt}`;
  await saveImageBlob(filename, file);
  return filename;
}

export async function getImageUrl(
  imagePath: string | null | undefined,
): Promise<string | null> {
  if (!imagePath) return null;

  const cached = imageUrlCache.get(imagePath);
  if (cached) return cached;

  const blob = await getImageBlob(imagePath);
  if (!blob) return null;

  const url = URL.createObjectURL(blob);
  imageUrlCache.set(imagePath, url);
  return url;
}

export async function getImageUrls(
  imagePaths: string[] | null | undefined,
): Promise<string[]> {
  if (!imagePaths?.length) return [];
  const urls = await Promise.all(imagePaths.map((path) => getImageUrl(path)));
  return urls.filter((url): url is string => url !== null);
}

export async function migrateLegacyDataIfNeeded(): Promise<void> {
  if (typeof window === "undefined") return;
  if (localStorage.getItem(LEGACY_MIGRATION_KEY)) return;

  const base = `${BASE_PATH}/legacy`;

  try {
    const [itemsRes, categoriesRes] = await Promise.all([
      fetch(`${base}/items.json`),
      fetch(`${base}/categories.json`),
    ]);
    if (!itemsRes.ok) return;

    const legacyItems = (await itemsRes.json()) as Item[];
    const legacyCategories = categoriesRes.ok
      ? ((await categoriesRes.json()) as Category[])
      : [];

    ensureDefaultCategories();
    const categories = readJson<Category[]>(CATEGORIES_KEY, []);
    const categoryIds = new Set(categories.map((category) => category.id));
    let categoriesChanged = false;

    for (const category of legacyCategories) {
      if (!categoryIds.has(category.id)) {
        categories.push(category);
        categoryIds.add(category.id);
        categoriesChanged = true;
      }
    }
    if (categoriesChanged) writeJson(CATEGORIES_KEY, categories);

    const items = readJson<Item[]>(ITEMS_KEY, []);
    const itemIds = new Set(items.map((item) => item.id));
    let itemsChanged = false;

    for (const item of legacyItems) {
      if (!itemIds.has(item.id)) {
        items.push(item);
        itemIds.add(item.id);
        itemsChanged = true;
      }
    }
    if (itemsChanged) writeJson(ITEMS_KEY, items);

    const imageFilenames = new Set<string>();
    for (const item of legacyItems) {
      for (const filename of item.imagePaths ?? []) {
        if (filename) imageFilenames.add(filename);
      }
    }

    for (const filename of imageFilenames) {
      const existing = await getImageBlob(filename);
      if (existing) continue;

      const res = await fetch(`${base}/uploads/${filename}`);
      if (!res.ok) continue;

      await saveImageBlob(filename, await res.blob());
    }

    localStorage.setItem(LEGACY_MIGRATION_KEY, new Date().toISOString());
    notifyDataChanged();
  } catch {
    // 無 legacy 資料或匯入失敗時略過，不影響正常使用
  }
}

export async function restoreFromBackupSnapshotIfNeeded(): Promise<void> {
  if (readAllItems().length > 0) return;

  const snapshot = getBackupSnapshot();
  if (!snapshot) return;

  await applyBackup(
    snapshot,
    "replace",
    readAllItems,
    writeAllItems,
    readAllCategories,
    writeAllCategories,
    saveImageBlob,
  );
}

export async function exportBackupDownload(): Promise<void> {
  const backup = await buildCurrentBackup();
  saveBackupSnapshot(backup);
  downloadBackupFile(backup);
}

export async function importBackupFromFile(
  file: File,
  mode: "merge" | "replace",
): Promise<{ itemsAdded: number; categoriesAdded: number }> {
  const text = await file.text();
  const backup = parseBackupFile(JSON.parse(text) as unknown);
  const result = await applyBackup(
    backup,
    mode,
    readAllItems,
    writeAllItems,
    readAllCategories,
    writeAllCategories,
    saveImageBlob,
  );
  notifyDataChanged();
  return result;
}

export async function bindSyncFolder(): Promise<FolderSyncResult> {
  const result = await pickSyncFolder();
  if (result.action === "unsupported" || result.action === "permission-denied") {
    return result;
  }

  const syncResult = await runFolderSync();
  return {
    ...syncResult,
    message: result.message ?? syncResult.message,
  };
}

export async function unbindSyncFolder(): Promise<void> {
  await disconnectSyncFolder();
}

export async function syncFolderNow(): Promise<FolderSyncResult> {
  return runFolderSync();
}

export async function syncFolderOnLoad(): Promise<FolderSyncResult | null> {
  if (!getFolderSyncInfo().bound) return null;
  return runFolderSync();
}

export {
  getFolderSyncInfo,
  getLastBackupAt,
  isFolderSyncSupported,
  type FolderSyncInfo,
  type FolderSyncResult,
};
