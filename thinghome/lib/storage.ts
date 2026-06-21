import { promises as fs } from "fs";
import path from "path";

export const UPLOAD_DIR = path.join(process.cwd(), "data", "uploads");

const ALLOWED_EXT = new Set([".jpg", ".jpeg", ".png", ".webp", ".gif"]);
const MAX_BYTES = 10 * 1024 * 1024;

export async function ensureUploadDir() {
  await fs.mkdir(UPLOAD_DIR, { recursive: true });
}

export function sanitizeFilename(filename: string): string | null {
  if (!/^[a-zA-Z0-9-]+\.(jpg|jpeg|png|webp|gif)$/i.test(filename)) {
    return null;
  }
  return filename;
}

export async function saveImage(
  buffer: Buffer,
  originalName: string,
): Promise<string> {
  const ext = path.extname(originalName).toLowerCase();
  if (!ALLOWED_EXT.has(ext)) {
    throw new Error("不支援的圖片格式");
  }
  if (buffer.length > MAX_BYTES) {
    throw new Error("圖片太大（上限 10 MB）");
  }

  await ensureUploadDir();
  const normalizedExt = ext === ".jpeg" ? ".jpg" : ext;
  const filename = `${crypto.randomUUID()}${normalizedExt}`;
  await fs.writeFile(path.join(UPLOAD_DIR, filename), buffer);
  return filename;
}

export async function deleteImage(filename: string | null | undefined) {
  if (!filename) return;

  const safe = sanitizeFilename(filename);
  if (!safe) return;

  try {
    await fs.unlink(path.join(UPLOAD_DIR, safe));
  } catch {
    // 檔案可能已不存在
  }
}

export function getImageContentType(filename: string): string {
  const ext = path.extname(filename).toLowerCase();
  const map: Record<string, string> = {
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".png": "image/png",
    ".webp": "image/webp",
    ".gif": "image/gif",
  };
  return map[ext] ?? "application/octet-stream";
}
