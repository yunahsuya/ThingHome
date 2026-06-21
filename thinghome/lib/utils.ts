import type { ItemInput, ParsedItemDraft } from "@/lib/types";

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

export function formatCurrency(value: number | null): string {
  if (value === null) return "—";
  return `NT$ ${value.toLocaleString("zh-TW")}`;
}

export function formatDate(value: string | null): string {
  if (!value) return "—";
  return value.replace(/-/g, "/");
}

export function expiryLabel(days: number | null): string {
  if (days === null) return "未設定";
  if (days < 0) return `已過期 ${Math.abs(days)} 天`;
  if (days === 0) return "今天到期";
  if (days <= 7) return `剩 ${days} 天（即將到期）`;
  return `剩 ${days} 天`;
}

export function getImageUrl(imagePath: string | null | undefined): string | null {
  if (!imagePath) return null;
  return `/api/uploads/${encodeURIComponent(imagePath)}`;
}

export async function uploadImageFile(file: File): Promise<string> {
  const form = new FormData();
  form.append("file", file);

  const res = await fetch("/api/upload", {
    method: "POST",
    body: form,
  });

  if (!res.ok) {
    const data = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(data.error ?? "照片上傳失敗");
  }

  const { imagePath } = (await res.json()) as { imagePath: string };
  return imagePath;
}

export function expiryTone(days: number | null): "neutral" | "warn" | "danger" {
  if (days === null) return "neutral";
  if (days < 0) return "danger";
  if (days <= 7) return "warn";
  return "neutral";
}
