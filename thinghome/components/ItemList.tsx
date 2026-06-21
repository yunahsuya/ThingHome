"use client";

import { useState } from "react";
import type { Item, ItemInput, ItemSubmitOptions } from "@/lib/types";
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
  onChanged: () => void;
}

export function ItemList({ items, onChanged }: ItemListProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

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
      <div className="rounded-2xl border border-dashed border-zinc-300 px-6 py-16 text-center dark:border-zinc-700">
        <p className="text-lg font-medium">還沒有商品</p>
        <p className="mt-2 text-sm text-zinc-500">
          點「新增商品」拍照或輸入，開始記錄家裡的東西
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {items.map((item) => {
        const days = getDaysRemaining(item);
        const tone = expiryTone(days);
        const imageUrl = getImageUrl(item.imagePath);

        if (editingId === item.id) {
          return (
            <div key={item.id} className="card">
              <h3 className="mb-4 font-semibold">編輯商品</h3>
              <ItemForm
                initial={item}
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
          <article key={item.id} className="card">
            <div className="flex gap-4">
              {imageUrl ? (
                <img
                  src={imageUrl}
                  alt={item.name}
                  className="h-24 w-24 shrink-0 rounded-xl object-cover bg-zinc-100 dark:bg-zinc-900"
                />
              ) : (
                <div className="flex h-24 w-24 shrink-0 items-center justify-center rounded-xl bg-zinc-100 text-2xl dark:bg-zinc-800">
                  📦
                </div>
              )}

              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h3 className="text-lg font-semibold">{item.name}</h3>
                    <p className="mt-1 text-sm text-zinc-500">
                      來源：
                      {item.source === "ocr"
                        ? "照片辨識"
                        : item.source === "text"
                          ? "文字解析"
                          : "手動輸入"}
                    </p>
                  </div>
                  <span
                    className={`badge ${
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
              </div>
            </div>

            <dl className="mt-4 grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
              <Stat label="購買日期" value={formatDate(item.purchaseDate)} />
              <Stat label="到期日" value={formatDate(item.expiryDate)} />
              <Stat
                label="剩餘"
                value={`${item.remaining}${item.unit ? ` ${item.unit}` : ""} / ${item.quantity}${item.unit ? ` ${item.unit}` : ""}`}
              />
              <Stat label="價格" value={formatCurrency(item.price)} />
            </dl>

            {item.notes && (
              <p className="mt-3 line-clamp-2 text-xs text-zinc-500">{item.notes}</p>
            )}

            <div className="mt-4 flex gap-2">
              <button
                type="button"
                className="btn-secondary text-sm"
                onClick={() => setEditingId(item.id)}
              >
                編輯
              </button>
              <button
                type="button"
                className="btn-danger text-sm"
                disabled={deletingId === item.id}
                onClick={async () => {
                  if (!confirm(`確定刪除「${item.name}」？`)) return;
                  setDeletingId(item.id);
                  await fetch(`/api/items/${item.id}`, { method: "DELETE" });
                  setDeletingId(null);
                  onChanged();
                }}
              >
                刪除
              </button>
            </div>
          </article>
        );
      })}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-zinc-500">{label}</dt>
      <dd className="mt-0.5 font-medium">{value}</dd>
    </div>
  );
}
