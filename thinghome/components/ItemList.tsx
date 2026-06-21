"use client";

import { useState } from "react";
import type { Category, Item, ItemInput, ItemSubmitOptions } from "@/lib/types";
import { getDaysRemaining } from "@/lib/parse-text";
import {
  expiryLabel,
  expiryTone,
  formatCurrency,
  formatDate,
  getImageUrl,
  uploadImageFile,
} from "@/lib/utils";
import { ItemForm } from "./ItemForm";

interface ItemListProps {
  items: Item[];
  categories: Category[];
  onChanged: () => void;
}

const SOURCE_LABEL: Record<Item["source"], string> = {
  ocr: "照片辨識",
  text: "文字解析",
  manual: "手動輸入",
};

export function ItemList({ items, categories, onChanged }: ItemListProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const categoryMap = new Map(categories.map((c) => [c.id, c.name]));

  async function updateItem(
    id: string,
    input: ItemInput,
    options?: ItemSubmitOptions,
  ) {
    let imagePath = input.imagePath ?? null;

    if (options?.removeImage) {
      imagePath = null;
    } else if (options?.imageFile) {
      imagePath = await uploadImageFile(options.imageFile);
    }

    const res = await fetch(`/api/items/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...input, imagePath }),
    });
    if (!res.ok) throw new Error("更新失敗");
  }

  if (items.length === 0) {
    return (
      <div className="empty-state">
        <div
          className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl text-2xl"
          style={{ background: "var(--accent-soft)" }}
        >
          📦
        </div>
        <p className="font-medium">還沒有商品</p>
        <p className="mt-1.5 text-sm" style={{ color: "var(--muted)" }}>
          點「新增商品」拍照或輸入，開始記錄家裡的東西
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {items.map((item) => {
        const days = getDaysRemaining(item);
        const tone = expiryTone(days);
        const imageUrl = getImageUrl(item.imagePath);
        const categoryName = item.categoryId
          ? categoryMap.get(item.categoryId)
          : null;

        if (editingId === item.id) {
          return (
            <div key={item.id} className="card">
              <h3 className="mb-4 font-semibold">編輯商品</h3>
              <ItemForm
                initial={item}
                categories={categories}
                submitLabel="儲存修改"
                onSubmit={async (input, options) => {
                  await updateItem(item.id, input, options);
                  setEditingId(null);
                  onChanged();
                }}
                onCancel={() => setEditingId(null)}
              />
            </div>
          );
        }

        return (
          <article key={item.id} className="card group">
            <div className="flex gap-4">
              {imageUrl ? (
                <img
                  src={imageUrl}
                  alt={item.name}
                  className="h-16 w-16 shrink-0 rounded-lg object-cover sm:h-20 sm:w-20"
                  style={{ border: "1px solid var(--border)" }}
                />
              ) : (
                <div
                  className="flex h-16 w-16 shrink-0 items-center justify-center rounded-lg text-xl sm:h-20 sm:w-20 sm:text-2xl"
                  style={{ background: "var(--accent-soft)", border: "1px solid var(--border)" }}
                >
                  📦
                </div>
              )}

              <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <h3 className="truncate font-semibold leading-snug">{item.name}</h3>
                    <p className="mt-0.5 text-xs" style={{ color: "var(--muted)" }}>
                      {categoryName ? (
                        <span
                          className="mr-2 inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium"
                          style={{
                            background: "var(--accent-soft)",
                            color: "var(--accent)",
                          }}
                        >
                          {categoryName}
                        </span>
                      ) : null}
                      {SOURCE_LABEL[item.source]}
                    </p>
                  </div>
                  <span
                    className={`badge shrink-0 ${
                      tone === "danger"
                        ? "badge-danger"
                        : tone === "warn"
                          ? "badge-warn"
                          : "badge-neutral"
                    }`}
                  >
                    {expiryLabel(days)}
                  </span>
                </div>

                <dl className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
                  <Stat label="購買日期" value={formatDate(item.purchaseDate)} />
                  <Stat label="到期日" value={formatDate(item.expiryDate)} />
                  <Stat
                    label="剩餘"
                    value={`${item.remaining}${item.unit ? ` ${item.unit}` : ""} / ${item.quantity}${item.unit ? ` ${item.unit}` : ""}`}
                  />
                  <Stat label="價格" value={formatCurrency(item.price)} />
                </dl>

                {item.notes && (
                  <p className="mt-2 line-clamp-1 text-xs" style={{ color: "var(--muted)" }}>
                    {item.notes}
                  </p>
                )}

                <div className="mt-3 flex gap-2 opacity-100 sm:opacity-60 sm:group-hover:opacity-100 transition-opacity">
                  <button
                    type="button"
                    className="btn-secondary"
                    onClick={() => setEditingId(item.id)}
                  >
                    <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                    編輯
                  </button>
                  <button
                    type="button"
                    className="btn-danger"
                    disabled={deletingId === item.id}
                    onClick={async () => {
                      if (!confirm(`確定刪除「${item.name}」？`)) return;
                      setDeletingId(item.id);
                      await fetch(`/api/items/${item.id}`, { method: "DELETE" });
                      setDeletingId(null);
                      onChanged();
                    }}
                  >
                    <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                    刪除
                  </button>
                </div>
              </div>
            </div>
          </article>
        );
      })}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="stat-box">
      <dt className="text-[11px] leading-none" style={{ color: "var(--muted)" }}>{label}</dt>
      <dd className="mt-1 text-sm font-medium leading-snug tabular-nums">{value}</dd>
    </div>
  );
}
