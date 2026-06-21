"use client";

import React from "react";
import type { ItemInput, ItemSubmitOptions } from "@/lib/types";
import { getImageUrl } from "@/lib/utils";

interface ItemFormProps {
  initial: ItemInput;
  submitLabel: string;
  imagePreview?: string | null;
  onSubmit: (input: ItemInput, options?: ItemSubmitOptions) => Promise<void>;
  onCancel?: () => void;
}

const empty: ItemInput = {
  name: "",
  purchaseDate: null,
  expiryDate: null,
  shelfLifeDays: null,
  quantity: 1,
  remaining: 1,
  price: null,
  unit: null,
  notes: null,
  imagePath: null,
  source: "manual",
};

export function ItemForm({
  initial,
  submitLabel,
  imagePreview,
  onSubmit,
  onCancel,
}: ItemFormProps) {
  const [form, setForm] = React.useState<ItemInput>({ ...empty, ...initial });
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [pendingImage, setPendingImage] = React.useState<File | null>(null);
  const [localPreview, setLocalPreview] = React.useState<string | null>(null);
  const [removeImage, setRemoveImage] = React.useState(false);

  const displayPreview =
    localPreview ??
    imagePreview ??
    getImageUrl(removeImage ? null : form.imagePath);

  React.useEffect(() => {
    return () => {
      if (localPreview?.startsWith("blob:")) {
        URL.revokeObjectURL(localPreview);
      }
    };
  }, [localPreview]);

  function handleImageChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    if (localPreview?.startsWith("blob:")) {
      URL.revokeObjectURL(localPreview);
    }

    setPendingImage(file);
    setLocalPreview(URL.createObjectURL(file));
    setRemoveImage(false);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) {
      setError("請輸入商品名稱");
      return;
    }

    setSaving(true);
    setError(null);
    try {
      await onSubmit(
        {
          ...form,
          name: form.name.trim(),
          quantity: Number(form.quantity) || 1,
          remaining: Number(form.remaining) || 0,
          shelfLifeDays: form.shelfLifeDays ? Number(form.shelfLifeDays) : null,
          price:
            form.price !== null && form.price !== undefined
              ? Number(form.price)
              : null,
        },
        {
          imageFile: pendingImage,
          removeImage,
        },
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "儲存失敗，請稍後再試");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <Field label="商品照片">
        <div className="space-y-3">
          {displayPreview ? (
            <img
              src={displayPreview}
              alt="商品照片"
              className="max-h-40 w-full rounded-xl object-contain bg-zinc-100 dark:bg-zinc-900"
            />
          ) : (
            <div className="rounded-xl border border-dashed border-zinc-300 px-4 py-8 text-center text-sm text-zinc-500 dark:border-zinc-700">
              尚未加入照片
            </div>
          )}
          <div className="flex flex-wrap gap-2">
            <label className="btn-secondary cursor-pointer text-sm">
              {displayPreview ? "更換照片" : "加入照片"}
              <input
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                onChange={handleImageChange}
              />
            </label>
            {displayPreview && (
              <button
                type="button"
                className="btn-secondary text-sm"
                onClick={() => {
                  if (localPreview?.startsWith("blob:")) {
                    URL.revokeObjectURL(localPreview);
                  }
                  setPendingImage(null);
                  setLocalPreview(null);
                  setRemoveImage(true);
                }}
              >
                移除照片
              </button>
            )}
          </div>
        </div>
      </Field>

      <Field label="商品名稱 *">
        <input
          className="input"
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
          placeholder="例如：鮮奶、衛生紙"
          required
        />
      </Field>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="購買日期">
          <input
            type="date"
            className="input"
            value={form.purchaseDate ?? ""}
            onChange={(e) =>
              setForm({ ...form, purchaseDate: e.target.value || null })
            }
          />
        </Field>
        <Field label="到期日">
          <input
            type="date"
            className="input"
            value={form.expiryDate ?? ""}
            onChange={(e) =>
              setForm({ ...form, expiryDate: e.target.value || null })
            }
          />
        </Field>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Field label="保存天數">
          <input
            type="number"
            min={1}
            className="input"
            value={form.shelfLifeDays ?? ""}
            onChange={(e) =>
              setForm({
                ...form,
                shelfLifeDays: e.target.value ? Number(e.target.value) : null,
              })
            }
            placeholder="例如 30"
          />
        </Field>
        <Field label="購買數量">
          <input
            type="number"
            min={1}
            className="input"
            value={form.quantity ?? 1}
            onChange={(e) =>
              setForm({ ...form, quantity: Number(e.target.value) || 1 })
            }
          />
        </Field>
        <Field label="剩餘數量">
          <input
            type="number"
            min={0}
            className="input"
            value={form.remaining ?? 1}
            onChange={(e) =>
              setForm({ ...form, remaining: Number(e.target.value) || 0 })
            }
          />
        </Field>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="價格 (NT$)">
          <input
            type="number"
            min={0}
            step="0.01"
            className="input"
            value={form.price ?? ""}
            onChange={(e) =>
              setForm({
                ...form,
                price: e.target.value ? Number(e.target.value) : null,
              })
            }
            placeholder="例如 89"
          />
        </Field>
        <Field label="單位">
          <input
            className="input"
            value={form.unit ?? ""}
            onChange={(e) =>
              setForm({ ...form, unit: e.target.value || null })
            }
            placeholder="包、瓶、盒…"
          />
        </Field>
      </div>

      <Field label="備註">
        <textarea
          className="input min-h-24 resize-y"
          value={form.notes ?? ""}
          onChange={(e) => setForm({ ...form, notes: e.target.value || null })}
          placeholder="OCR 原文或其他備註"
        />
      </Field>

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

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block space-y-1.5">
      <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
        {label}
      </span>
      {children}
    </label>
  );
}
