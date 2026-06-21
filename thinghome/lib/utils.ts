import type { ItemInput, ParsedItemDraft } from "@/lib/types";
import { uploadImageFile as storeImageFile } from "@/lib/client-api";

export function draftToInput(
  draft: ParsedItemDraft,
  source: ItemInput["source"] = "text",
): ItemInput {
  return {
    name: draft.name ?? "未命名商品",
    purchaseDate: draft.purchaseDate,
    expiryDate: draft.expiryDate,
    shelfLifeDays: draft.shelfLifeDays,
    quantity: draft.quantity ?? 1,
    remaining: draft.remaining ?? draft.quantity ?? 1,
    price: draft.price,
    unit: draft.unit,
    notes: draft.notes,
    source,
  };
}

export function mergeDraftIntoForm(
  form: ItemInput,
  draft: ParsedItemDraft,
  source: ItemInput["source"] = "ocr",
): ItemInput {
  const fromDraft = draftToInput(draft, source);
  const pick = <T>(current: T | null | undefined, parsed: T | null | undefined) =>
    current ?? parsed ?? null;

  return {
    ...form,
    name: form.name.trim() ? form.name : fromDraft.name,
    purchaseDate: pick(form.purchaseDate, fromDraft.purchaseDate),
    expiryDate: pick(form.expiryDate, fromDraft.expiryDate),
    shelfLifeDays: form.shelfLifeDays ?? fromDraft.shelfLifeDays ?? null,
    quantity: form.quantity && form.quantity !== 1 ? form.quantity : fromDraft.quantity ?? 1,
    remaining:
      form.remaining !== undefined && form.remaining !== 1
        ? form.remaining
        : fromDraft.remaining ?? fromDraft.quantity ?? 1,
    price: form.price ?? fromDraft.price ?? null,
    unit: form.unit ?? fromDraft.unit ?? null,
    notes: form.notes ?? fromDraft.notes ?? null,
    source: form.source === "manual" ? source : form.source ?? source,
  };
}

export function formatCurrency(value: number | null): string {
  if (value === null) return "—";
  return `NT$ ${value.toLocaleString("zh-TW")}`;
}

export function formatDate(value: string | null): string {
  if (!value) return "—";
  return value.replace(/-/g, "/");
}

export function expiryLabel(days: number | null): string {
  if (days === null) return "無期限";
  if (days < 0) return `已過期 ${Math.abs(days)} 天`;
  if (days === 0) return "今天到期";
  if (days <= 7) return `剩 ${days} 天（即將到期）`;
  return `剩 ${days} 天`;
}

export async function uploadImageFile(file: File): Promise<string> {
  return storeImageFile(file);
}

export async function uploadImageFiles(files: File[]): Promise<string[]> {
  return Promise.all(files.map((file) => uploadImageFile(file)));
}

export async function resolveItemImagePaths(
  existingPaths: string[] | undefined,
  options?: {
    addedImageFiles?: File[];
    removedImagePaths?: string[];
  },
): Promise<string[]> {
  let paths = [...(existingPaths ?? [])];

  if (options?.removedImagePaths?.length) {
    const removed = new Set(options.removedImagePaths);
    paths = paths.filter((path) => !removed.has(path));
  }

  if (options?.addedImageFiles?.length) {
    const uploaded = await uploadImageFiles(options.addedImageFiles);
    paths = [...paths, ...uploaded];
  }

  return paths;
}

export function expiryTone(days: number | null): "neutral" | "warn" | "danger" {
  if (days === null) return "neutral";
  if (days < 0) return "danger";
  if (days <= 7) return "warn";
  return "neutral";
}
