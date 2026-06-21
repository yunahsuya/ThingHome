import {
  getLastBackupAt,
  parseBackupFile,
  type ThingHomeBackup,
} from "@/lib/backup";
import type { Category, Item } from "@/lib/types";

export const SYNC_BACKUP_FILENAME = "thinghome-backup.json";
const SYNC_DB = "thinghome-sync";
const SYNC_STORE = "meta";
const FOLDER_HANDLE_KEY = "folder";
const FOLDER_NAME_KEY = "thinghome:sync-folder-name";
const LAST_FOLDER_SYNC_KEY = "thinghome:last-folder-sync-at";

type SyncAction = "pulled" | "pushed" | "unchanged" | "no-folder" | "unsupported" | "permission-denied";

export interface FolderSyncResult {
  action: SyncAction;
  message?: string;
  localAt?: string;
  remoteAt?: string;
}

export interface FolderSyncInfo {
  supported: boolean;
  bound: boolean;
  folderName: string | null;
  lastSyncAt: string | null;
}

function openSyncDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(SYNC_DB, 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(SYNC_STORE)) {
        db.createObjectStore(SYNC_STORE);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("IndexedDB open failed"));
  });
}

async function idbGet<T>(key: string): Promise<T | null> {
  const db = await openSyncDb();
  const value = await new Promise<T | null>((resolve, reject) => {
    const tx = db.transaction(SYNC_STORE, "readonly");
    const request = tx.objectStore(SYNC_STORE).get(key);
    request.onsuccess = () => resolve((request.result as T | undefined) ?? null);
    request.onerror = () => reject(request.error ?? new Error("IndexedDB read failed"));
  });
  db.close();
  return value;
}

async function idbSet(key: string, value: unknown): Promise<void> {
  const db = await openSyncDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(SYNC_STORE, "readwrite");
    tx.objectStore(SYNC_STORE).put(value, key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error("IndexedDB write failed"));
  });
  db.close();
}

async function idbDelete(key: string): Promise<void> {
  const db = await openSyncDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(SYNC_STORE, "readwrite");
    tx.objectStore(SYNC_STORE).delete(key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error("IndexedDB delete failed"));
  });
  db.close();
}

export function isFolderSyncSupported(): boolean {
  return typeof window !== "undefined" && "showDirectoryPicker" in window;
}

export function getFolderSyncInfo(): FolderSyncInfo {
  if (!isFolderSyncSupported()) {
    return {
      supported: false,
      bound: false,
      folderName: null,
      lastSyncAt: null,
    };
  }

  return {
    supported: true,
    bound: Boolean(localStorage.getItem(FOLDER_NAME_KEY)),
    folderName: localStorage.getItem(FOLDER_NAME_KEY),
    lastSyncAt: localStorage.getItem(LAST_FOLDER_SYNC_KEY),
  };
}

function setLastSyncAt(iso: string) {
  localStorage.setItem(LAST_FOLDER_SYNC_KEY, iso);
}

export function getLocalDataTimestamp(
  items: Item[],
  categories: Category[],
): string {
  const candidates = [
    getLastBackupAt(),
    ...items.map((item) => item.updatedAt),
    ...categories.map((category) => category.updatedAt),
  ].filter((value): value is string => Boolean(value));

  if (candidates.length === 0) return new Date(0).toISOString();
  return candidates.reduce((latest, current) =>
    current > latest ? current : latest,
  );
}

async function getStoredFolderHandle(): Promise<FileSystemDirectoryHandle | null> {
  return idbGet<FileSystemDirectoryHandle>(FOLDER_HANDLE_KEY);
}

async function ensureFolderPermission(
  handle: FileSystemDirectoryHandle,
): Promise<boolean> {
  const options = { mode: "readwrite" as const };
  if ((await handle.queryPermission(options)) === "granted") return true;
  if ((await handle.requestPermission(options)) === "granted") return true;
  return false;
}

async function readBackupFromFolder(
  handle: FileSystemDirectoryHandle,
): Promise<ThingHomeBackup | null> {
  try {
    const fileHandle = await handle.getFileHandle(SYNC_BACKUP_FILENAME);
    const file = await fileHandle.getFile();
    const text = await file.text();
    return parseBackupFile(JSON.parse(text) as unknown);
  } catch (error) {
    if (error instanceof DOMException && error.name === "NotFoundError") {
      return null;
    }
    throw error;
  }
}

async function writeBackupToFolder(
  handle: FileSystemDirectoryHandle,
  backup: ThingHomeBackup,
): Promise<void> {
  const fileHandle = await handle.getFileHandle(SYNC_BACKUP_FILENAME, {
    create: true,
  });
  const writable = await fileHandle.createWritable();
  await writable.write(JSON.stringify(backup, null, 2));
  await writable.close();
}

export async function pickSyncFolder(): Promise<FolderSyncResult> {
  if (!isFolderSyncSupported()) {
    return { action: "unsupported", message: "此瀏覽器不支援資料夾同步" };
  }

  const handle = await window.showDirectoryPicker({ mode: "readwrite" });
  if (!(await ensureFolderPermission(handle))) {
    return { action: "permission-denied", message: "未取得資料夾讀寫權限" };
  }

  await idbSet(FOLDER_HANDLE_KEY, handle);
  localStorage.setItem(FOLDER_NAME_KEY, handle.name);

  return { action: "unchanged", message: `已綁定資料夾：${handle.name}` };
}

export async function disconnectSyncFolder(): Promise<void> {
  await idbDelete(FOLDER_HANDLE_KEY);
  localStorage.removeItem(FOLDER_NAME_KEY);
  localStorage.removeItem(LAST_FOLDER_SYNC_KEY);
}

export async function syncWithBoundFolder(options: {
  localBackup: ThingHomeBackup;
  localTimestamp: string;
  applyRemote: (backup: ThingHomeBackup) => Promise<void>;
}): Promise<FolderSyncResult> {
  if (!isFolderSyncSupported()) {
    return { action: "unsupported" };
  }

  const handle = await getStoredFolderHandle();
  if (!handle) {
    return { action: "no-folder" };
  }

  if (!(await ensureFolderPermission(handle))) {
    return { action: "permission-denied", message: "請重新授權同步資料夾" };
  }

  const remote = await readBackupFromFolder(handle);
  const remoteAt = remote?.exportedAt ?? null;
  const localAt = options.localTimestamp;

  const hasLocalData =
    options.localBackup.items.length > 0 ||
    options.localBackup.categories.length > 0;

  if (!remote) {
    if (!hasLocalData) {
      setLastSyncAt(new Date().toISOString());
      return { action: "unchanged", localAt, remoteAt: undefined };
    }

    const backup = { ...options.localBackup, exportedAt: new Date().toISOString() };
    await writeBackupToFolder(handle, backup);
    setLastSyncAt(backup.exportedAt);
    return { action: "pushed", localAt: backup.exportedAt, remoteAt: undefined };
  }

  if (!hasLocalData) {
    await options.applyRemote(remote);
    setLastSyncAt(new Date().toISOString());
    return { action: "pulled", localAt, remoteAt: remote.exportedAt };
  }

  if (remoteAt && remoteAt > localAt) {
    await options.applyRemote(remote);
    setLastSyncAt(new Date().toISOString());
    return { action: "pulled", localAt, remoteAt };
  }

  if (!remoteAt || localAt > remoteAt) {
    const backup = { ...options.localBackup, exportedAt: new Date().toISOString() };
    await writeBackupToFolder(handle, backup);
    setLastSyncAt(backup.exportedAt);
    return { action: "pushed", localAt: backup.exportedAt, remoteAt: remoteAt ?? undefined };
  }

  setLastSyncAt(new Date().toISOString());
  return { action: "unchanged", localAt, remoteAt: remoteAt ?? undefined };
}

let folderSyncTimer: ReturnType<typeof setTimeout> | null = null;

export function scheduleFolderSync(run: () => Promise<FolderSyncResult>) {
  if (!getFolderSyncInfo().bound) return;

  if (folderSyncTimer) clearTimeout(folderSyncTimer);
  folderSyncTimer = setTimeout(() => {
    void run().catch(() => {
      // 背景同步失敗不影響正常使用
    });
  }, 2000);
}
