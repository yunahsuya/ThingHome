"use client";

import React from "react";
import type { Category, Item, ItemInput, ItemSubmitOptions } from "@/lib/types";
import { runOcrOnFile } from "@/lib/ocr";
import { getImageUrl as resolveStoredImageUrl } from "@/lib/client-api";
import { mergeDraftIntoForm } from "@/lib/utils";
import { CategoryField } from "./CategoryField";

export interface ItemFormProps {
  initial: ItemInput | Item;
  submitLabel?: string;
  categories?: Category[];
  imagePreview?: string | null;
  showActions?: boolean;
  compact?: boolean;
  enableOcr?: boolean;
  onSubmit?: (input: ItemInput, options?: ItemSubmitOptions) => Promise<void>;
  onCancel?: () => void;
  onCategoriesChanged?: () => void | Promise<void>;
  onChange?: (input: ItemInput, options?: ItemSubmitOptions) => void;
}

const empty: ItemInput = {
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
  source: "manual",
};

function toItemInput(initial: ItemInput | Item): ItemInput {
  return {
    name: initial.name,
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
  };
}

export function ItemForm({
  initial,
  submitLabel = "儲存",
  categories = [],
  imagePreview,
  showActions = true,
  compact = false,
  enableOcr = false,
  onSubmit,
  onCancel,
  onCategoriesChanged,
  onChange,
}: ItemFormProps) {
  const [form, setForm] = React.useState<ItemInput>(() => toItemInput(initial));
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [pendingFiles, setPendingFiles] = React.useState<File[]>([]);
  const [pendingPreviews, setPendingPreviews] = React.useState<string[]>([]);
  const [removedPaths, setRemovedPaths] = React.useState<string[]>([]);
  const [ocrLoading, setOcrLoading] = React.useState(false);
  const [ocrProgress, setOcrProgress] = React.useState(0);
  const [ocrStatus, setOcrStatus] = React.useState<string | null>(null);
  const ocrInputRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    setForm(toItemInput(initial));
    setPendingFiles([]);
    setPendingPreviews((prev) => {
      prev.forEach((url) => {
        if (url.startsWith("blob:")) URL.revokeObjectURL(url);
      });
      return [];
    });
    setRemovedPaths([]);
  }, [initial]);

  React.useEffect(() => {
    if (!onChange || showActions) return;
    onChange(form, {
      addedImageFiles: pendingFiles.length ? pendingFiles : undefined,
      removedImagePaths: removedPaths.length ? removedPaths : undefined,
    });
  }, [form, pendingFiles, removedPaths, onChange, showActions]);

  React.useEffect(() => {
    return () => {
      pendingPreviews.forEach((url) => {
        if (url.startsWith("blob:")) URL.revokeObjectURL(url);
      });
    };
  }, [pendingPreviews]);

  const existingPaths = (form.imagePaths ?? []).filter(
    (path) => !removedPaths.includes(path),
  );

  const submitOptions: ItemSubmitOptions = {
    addedImageFiles: pendingFiles.length ? pendingFiles : undefined,
    removedImagePaths: removedPaths.length ? removedPaths : undefined,
  };

  function updateForm(next: ItemInput) {
    setForm(next);
    onChange?.(next, submitOptions);
  }

  function handleImageChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    if (!files.length) return;

    const previews = files.map((file) => URL.createObjectURL(file));
    setPendingFiles((prev) => [...prev, ...files]);
    setPendingPreviews((prev) => [...prev, ...previews]);
    e.target.value = "";
  }

  async function handleOcrImageChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    setOcrLoading(true);
    setOcrProgress(0);
    setOcrStatus("載入 OCR 引擎…");
    setError(null);

    try {
      const draft = await runOcrOnFile(file, ({ progress, status }) => {
        setOcrProgress(progress);
        setOcrStatus(status);
      });

      const merged = mergeDraftIntoForm(form, draft, "ocr");
      setForm(merged);

      const preview = URL.createObjectURL(file);
      setPendingFiles((prev) => [...prev, file]);
      setPendingPreviews((prev) => [...prev, preview]);
      setOcrStatus("辨識完成，請確認欄位");

      onChange?.(merged, {
        addedImageFiles: [...pendingFiles, file],
        removedImagePaths: removedPaths.length ? removedPaths : undefined,
      });
    } catch {
      setOcrStatus("辨識失敗，請換張較清楚的照片");
    } finally {
      setOcrLoading(false);
    }
  }

  function removeExistingImage(path: string) {
    setRemovedPaths((prev) => [...prev, path]);
  }

  function removePendingImage(index: number) {
    const preview = pendingPreviews[index];
    if (preview?.startsWith("blob:")) URL.revokeObjectURL(preview);
    setPendingFiles((prev) => prev.filter((_, i) => i !== index));
    setPendingPreviews((prev) => prev.filter((_, i) => i !== index));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) {
      setError("請輸入商品名稱");
      return;
    }

    if (!onSubmit) return;

    setSaving(true);
    setError(null);
    try {
      await onSubmit(
        {
          ...form,
          name: form.name.trim(),
          location: form.location?.trim() || null,
          quantity:
            form.quantity !== null && form.quantity !== undefined
              ? Number(form.quantity)
              : null,
          remaining:
            form.remaining !== null && form.remaining !== undefined
              ? Number(form.remaining)
              : null,
          shelfLifeDays: form.shelfLifeDays ? Number(form.shelfLifeDays) : null,
          price:
            form.price !== null && form.price !== undefined
              ? Number(form.price)
              : null,
        },
        submitOptions,
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "儲存失敗，請稍後再試");
    } finally {
      setSaving(false);
    }
  }

  const hasImages =
    existingPaths.length > 0 ||
    pendingPreviews.length > 0 ||
    Boolean(imagePreview);

  const Wrapper = showActions && onSubmit ? "form" : "div";

  return (
    <Wrapper
      {...(showActions && onSubmit
        ? { onSubmit: handleSubmit }
        : {})}
      className={compact ? "space-y-3" : "space-y-4"}
    >
      <Field label="商品照片">
        <div className="space-y-3">
          {hasImages ? (
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {imagePreview && (
                <ImageThumb src={imagePreview} alt="OCR 照片" />
              )}
              {existingPaths.map((path) => (
                <StoredImageThumb
                  key={path}
                  path={path}
                  alt="商品照片"
                  onRemove={() => removeExistingImage(path)}
                />
              ))}
              {pendingPreviews.map((preview, index) => (
                <ImageThumb
                  key={preview}
                  src={preview}
                  alt="待上傳照片"
                  onRemove={() => removePendingImage(index)}
                />
              ))}
            </div>
          ) : (
            <div
              className="rounded-xl border border-dashed px-4 py-8 text-center text-sm"
              style={{ borderColor: "var(--border-strong)", color: "var(--muted)" }}
            >
              尚未加入照片
            </div>
          )}
          <div className="flex flex-wrap gap-2">
            <label className="btn-secondary inline-flex cursor-pointer text-sm">
              加入照片
              <input
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={handleImageChange}
                disabled={ocrLoading}
              />
            </label>
            {enableOcr && (
              <>
                <label className="btn-primary inline-flex cursor-pointer text-sm">
                  {ocrLoading ? "辨識中…" : "📷 拍照辨識"}
                  <input
                    ref={ocrInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleOcrImageChange}
                    disabled={ocrLoading}
                  />
                </label>
              </>
            )}
          </div>
          {enableOcr && ocrLoading && (
            <div className="space-y-2">
              <div
                className="h-1.5 overflow-hidden rounded-full"
                style={{ background: "var(--accent-soft)" }}
              >
                <div
                  className="h-full rounded-full transition-all"
                  style={{ width: `${ocrProgress}%`, background: "var(--accent)" }}
                />
              </div>
              <p className="text-xs" style={{ color: "var(--muted)" }}>
                {ocrStatus}
              </p>
            </div>
          )}
          {enableOcr && !ocrLoading && ocrStatus && (
            <p className="text-xs" style={{ color: "var(--accent)" }}>
              {ocrStatus}
            </p>
          )}
        </div>
      </Field>

      <Field label="商品名稱 *">
        <input
          className="input"
          value={form.name}
          onChange={(e) => updateForm({ ...form, name: e.target.value })}
          placeholder="例如：鮮奶、衛生紙"
          required
        />
      </Field>

      <Field label="分類">
        <CategoryField
          categories={categories}
          value={form.categoryId ?? null}
          onChange={(categoryId) => updateForm({ ...form, categoryId })}
          onCategoriesChanged={onCategoriesChanged ?? (() => {})}
        />
      </Field>

      <Field label="東西放在哪裡">
        <input
          className="input"
          value={form.location ?? ""}
          onChange={(e) =>
            updateForm({ ...form, location: e.target.value || null })
          }
          placeholder="例如：冰箱上層、書房書櫃第三格"
        />
      </Field>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="購買日期">
          <input
            type="date"
            className="input"
            value={form.purchaseDate ?? ""}
            onChange={(e) =>
              updateForm({ ...form, purchaseDate: e.target.value || null })
            }
          />
        </Field>
        <Field label="到期日">
          <input
            type="date"
            className="input"
            value={form.expiryDate ?? ""}
            onChange={(e) =>
              updateForm({ ...form, expiryDate: e.target.value || null })
            }
            placeholder="選填"
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
              updateForm({
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
            min={0}
            className="input"
            value={form.quantity ?? ""}
            onChange={(e) =>
              updateForm({
                ...form,
                quantity: e.target.value ? Number(e.target.value) : null,
              })
            }
            placeholder="選填"
          />
        </Field>
        <Field label="剩餘數量">
          <input
            type="number"
            min={0}
            className="input"
            value={form.remaining ?? ""}
            onChange={(e) =>
              updateForm({
                ...form,
                remaining: e.target.value ? Number(e.target.value) : null,
              })
            }
            placeholder="選填"
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
              updateForm({
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
              updateForm({ ...form, unit: e.target.value || null })
            }
            placeholder="包、瓶、盒…"
          />
        </Field>
      </div>

      <Field label="備註">
        <textarea
          className="input min-h-24 resize-y"
          value={form.notes ?? ""}
          onChange={(e) => updateForm({ ...form, notes: e.target.value || null })}
          placeholder="OCR 原文或其他備註"
        />
      </Field>

      {error && <p className="text-sm text-red-600">{error}</p>}

      {showActions && onSubmit && (
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
      )}
    </Wrapper>
  );
}

function StoredImageThumb({
  path,
  alt,
  onRemove,
}: {
  path: string;
  alt: string;
  onRemove?: () => void;
}) {
  const [src, setSrc] = React.useState<string | null>(null);

  React.useEffect(() => {
    let cancelled = false;
    void resolveStoredImageUrl(path).then((url) => {
      if (!cancelled) setSrc(url);
    });
    return () => {
      cancelled = true;
    };
  }, [path]);

  if (!src) {
    return (
      <div
        className="aspect-square w-full rounded-xl"
        style={{ background: "var(--accent-soft)" }}
      />
    );
  }

  return <ImageThumb src={src} alt={alt} onRemove={onRemove} />;
}

function ImageThumb({
  src,
  alt,
  onRemove,
}: {
  src: string;
  alt: string;
  onRemove?: () => void;
}) {
  return (
    <div className="relative">
      <img
        src={src}
        alt={alt}
        className="aspect-square w-full rounded-xl object-cover"
        style={{ background: "var(--accent-soft)" }}
      />
      {onRemove && (
        <button
          type="button"
          className="absolute right-1 top-1 rounded-full px-1.5 py-0.5 text-xs text-white"
          style={{ background: "rgba(0,0,0,0.55)" }}
          onClick={onRemove}
          aria-label="移除照片"
        >
          ✕
        </button>
      )}
    </div>
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
      <span className="text-sm font-medium" style={{ color: "var(--foreground)" }}>
        {label}
      </span>
      {children}
    </label>
  );
}
