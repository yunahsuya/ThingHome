"use client";

import React from "react";
import type { Category, Item, ItemInput, ItemSubmitOptions } from "@/lib/types";
import { ItemForm } from "./ItemForm";

export interface ItemFormEntry {
  key: string;
  initial: ItemInput | Item;
  imagePreview?: string | null;
  ocrFile?: File | null;
}

interface MultiItemFormProps {
  entries: ItemFormEntry[];
  categories: Category[];
  submitLabel: string;
  onSubmit: (
    items: Array<{ input: ItemInput; options?: ItemSubmitOptions }>,
  ) => Promise<void>;
  onCancel?: () => void;
  onCategoriesChanged?: () => void | Promise<void>;
  onAddEntry?: () => void;
  onRemoveEntry?: (key: string) => void;
  minEntries?: number;
  enableOcr?: boolean;
}

export function MultiItemForm({
  entries,
  categories,
  submitLabel,
  onSubmit,
  onCancel,
  onCategoriesChanged,
  onAddEntry,
  onRemoveEntry,
  minEntries = 1,
  enableOcr = false,
}: MultiItemFormProps) {
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const formDataRef = React.useRef<
    Map<string, { input: ItemInput; options?: ItemSubmitOptions }>
  >(new Map());

  function handleFormChange(
    key: string,
    input: ItemInput,
    options?: ItemSubmitOptions,
  ) {
    formDataRef.current.set(key, { input, options });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const items = entries.map((entry) => {
      const data = formDataRef.current.get(entry.key);
      if (data) return data;
      const initial = entry.initial as ItemInput;
      return {
        input: {
          name: initial.name ?? "",
          categoryId: initial.categoryId ?? null,
          location: initial.location ?? null,
          purchaseDate: initial.purchaseDate ?? null,
          expiryDate: initial.expiryDate ?? null,
          shelfLifeDays: initial.shelfLifeDays ?? null,
          quantity: initial.quantity ?? null,
          remaining: initial.remaining ?? null,
          price: initial.price ?? null,
          unit: initial.unit ?? null,
          notes: initial.notes ?? null,
          imagePaths: initial.imagePaths ?? [],
          source: initial.source ?? "manual",
        },
      };
    });

    const namedItems = items.filter((item) => item.input.name?.trim());
    if (namedItems.length === 0) {
      setError("請至少填寫一項商品名稱");
      return;
    }

    setSaving(true);
    try {
      await onSubmit(items);
    } catch (err) {
      setError(err instanceof Error ? err.message : "儲存失敗，請稍後再試");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-4">
        {entries.map((entry, index) => (
          <div
            key={entry.key}
            className="rounded-xl border p-4"
            style={{ borderColor: "var(--border-strong)" }}
          >
            <div className="mb-3 flex items-center justify-between gap-2">
              <h4 className="text-sm font-semibold">
                商品 {index + 1}
                {entry.initial.name ? `：${entry.initial.name}` : ""}
              </h4>
              {onRemoveEntry && entries.length > minEntries && (
                <button
                  type="button"
                  className="btn-danger text-xs"
                  onClick={() => onRemoveEntry(entry.key)}
                >
                  移除此項
                </button>
              )}
            </div>
            <ItemForm
              initial={entry.initial}
              categories={categories}
              imagePreview={entry.imagePreview}
              showActions={false}
              compact
              enableOcr={enableOcr}
              onCategoriesChanged={onCategoriesChanged}
              onChange={(input, options) =>
                handleFormChange(entry.key, input, options)
              }
            />
          </div>
        ))}
      </div>

      {onAddEntry && (
        <button type="button" className="btn-secondary w-full" onClick={onAddEntry}>
          ＋ 再加一項商品
        </button>
      )}

      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="flex flex-wrap gap-3 pt-2">
        <button type="submit" className="btn-primary" disabled={saving}>
          {saving ? "儲存中…" : submitLabel}
        </button>
        {onCancel && (
          <button type="button" className="btn-secondary" onClick={onCancel}>
            取消
          </button>
        )}
      </div>
    </form>
  );
}

export function createFormKey(): string {
  return crypto.randomUUID();
}

export function createEmptyItemInput(
  source: ItemInput["source"] = "manual",
): ItemInput {
  return {
    name: "",
    categoryId: null,
    location: null,
    purchaseDate: null,
    expiryDate: null,
    shelfLifeDays: null,
    quantity: null,
    remaining: null,
    price: null,
    unit: null,
    notes: null,
    imagePaths: [],
    source,
  };
}

export function createEmptyFormEntry(
  source: ItemInput["source"] = "manual",
): ItemFormEntry {
  return {
    key: createFormKey(),
    initial: createEmptyItemInput(source),
    imagePreview: null,
    ocrFile: null,
  };
}
