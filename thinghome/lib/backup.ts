import type { Category, Item } from "@/lib/types";

export const BACKUP_VERSION = 1;
export const BACKUP_SNAPSHOT_KEY = "thinghome:backup-snapshot";
export const AUTO_BACKUP_KEY = "thinghome:auto-backup-file";
export const LAST_BACKUP_AT_KEY = "thinghome:last-backup-at";

export interface BackupImage {
  mime: string;
  data: string;
}

export interface ThingHomeBackup {
  version: number;
  exportedAt: string;
  items: Item[];
  categories: Category[];
  images: Record<string, BackupImage>;
}

type ImageBlobReader = (filename: string) => Promise<Blob | null>;
type ImageBlobWriter = (filename: string, blob: Blob) => Promise<void>;

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result;
      if (typeof result !== "string") {
        reject(new Error("讀取圖片失敗"));
        return;
      }
      const base64 = result.split(",")[1];
      if (!base64) {
        reject(new Error("讀取圖片失敗"));
        return;
      }
      resolve(base64);
    };
    reader.onerror = () => reject(reader.error ?? new Error("讀取圖片失敗"));
    reader.readAsDataURL(blob);
  });
}

function base64ToBlob(base64: string, mime: string): Blob {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new Blob([bytes], { type: mime });
}

function collectImageFilenames(items: Item[]): string[] {
  const filenames = new Set<string>();
  for (const item of items) {
    for (const filename of item.imagePaths ?? []) {
      if (filename) filenames.add(filename);
    }
  }
  return [...filenames];
}

export async function buildBackup(
  items: Item[],
  categories: Category[],
  readImageBlob: ImageBlobReader,
): Promise<ThingHomeBackup> {
  const images: Record<string, BackupImage> = {};

  for (const filename of collectImageFilenames(items)) {
    const blob = await readImageBlob(filename);
    if (!blob) continue;
    images[filename] = {
      mime: blob.type || "image/jpeg",
      data: await blobToBase64(blob),
    };
  }

  return {
    version: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    items,
    categories,
    images,
  };
}

export function downloadBackupFile(
  backup: ThingHomeBackup,
  filename = "thinghome-backup.json",
) {
  const blob = new Blob([JSON.stringify(backup, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

export function saveBackupSnapshot(backup: ThingHomeBackup) {
  try {
    localStorage.setItem(BACKUP_SNAPSHOT_KEY, JSON.stringify(backup));
    localStorage.setItem(LAST_BACKUP_AT_KEY, backup.exportedAt);
  } catch {
    // localStorage 空間不足時略過，仍保留下載備份
  }
}

export function getLastBackupAt(): string | null {
  return localStorage.getItem(LAST_BACKUP_AT_KEY);
}

export function isAutoBackupEnabled(): boolean {
  const value = localStorage.getItem(AUTO_BACKUP_KEY);
  return value !== "false";
}

export function setAutoBackupEnabled(enabled: boolean) {
  localStorage.setItem(AUTO_BACKUP_KEY, enabled ? "true" : "false");
}

export function parseBackupFile(raw: unknown): ThingHomeBackup {
  if (!raw || typeof raw !== "object") {
    throw new Error("備份格式不正確");
  }

  const backup = raw as Partial<ThingHomeBackup>;
  if (!Array.isArray(backup.items) || !Array.isArray(backup.categories)) {
    throw new Error("備份缺少商品或分類資料");
  }

  return {
    version: backup.version ?? 1,
    exportedAt: backup.exportedAt ?? new Date().toISOString(),
    items: backup.items,
    categories: backup.categories,
    images: backup.images ?? {},
  };
}

export async function applyBackup(
  backup: ThingHomeBackup,
  mode: "merge" | "replace",
  readItems: () => Item[],
  writeItems: (items: Item[]) => void,
  readCategories: () => Category[],
  writeCategories: (categories: Category[]) => void,
  writeImageBlob: ImageBlobWriter,
): Promise<{ itemsAdded: number; categoriesAdded: number }> {
  let items = readItems();
  let categories = readCategories();

  if (mode === "replace") {
    items = [];
    categories = [];
  }

  const categoryIds = new Set(categories.map((category) => category.id));
  let categoriesAdded = 0;
  for (const category of backup.categories) {
    if (!categoryIds.has(category.id)) {
      categories.push(category);
      categoryIds.add(category.id);
      categoriesAdded++;
    }
  }

  const itemIds = new Set(items.map((item) => item.id));
  let itemsAdded = 0;
  for (const item of backup.items) {
    if (!itemIds.has(item.id)) {
      items.push(item);
      itemIds.add(item.id);
      itemsAdded++;
    }
  }

  writeCategories(categories);
  writeItems(items);

  for (const [filename, image] of Object.entries(backup.images)) {
    await writeImageBlob(filename, base64ToBlob(image.data, image.mime));
  }

  saveBackupSnapshot(backup);
  return { itemsAdded, categoriesAdded };
}

export function getBackupSnapshot(): ThingHomeBackup | null {
  try {
    const raw = localStorage.getItem(BACKUP_SNAPSHOT_KEY);
    if (!raw) return null;
    return parseBackupFile(JSON.parse(raw) as unknown);
  } catch {
    return null;
  }
}

let backupTimer: ReturnType<typeof setTimeout> | null = null;
let lastBackupHash = "";

export function scheduleAutoBackup(build: () => Promise<ThingHomeBackup>) {
  if (!isAutoBackupEnabled()) return;

  if (backupTimer) clearTimeout(backupTimer);
  backupTimer = setTimeout(() => {
    void (async () => {
      try {
        const backup = await build();
        const hash = JSON.stringify({
          items: backup.items,
          categories: backup.categories,
          images: Object.keys(backup.images).sort(),
        });
        if (hash === lastBackupHash) return;
        lastBackupHash = hash;

        saveBackupSnapshot(backup);
        downloadBackupFile(backup);
      } catch {
        // 自動備份失敗不影響正常使用
      }
    })();
  }, 1500);
}
