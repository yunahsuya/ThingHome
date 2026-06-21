"use client";

import { useMemo, useState } from "react";
import type { Category, Item, ItemInput, ItemSubmitOptions } from "@/lib/types";
import { getDaysRemaining } from "@/lib/parse-text";
import {
  buildItemDisplayUnits,
  formatBatchLabel,
} from "@/lib/item-groups";
import {
  expiryLabel,
  expiryTone,
  formatCurrency,
  formatDate,
  resolveItemImagePaths,
} from "@/lib/utils";
import {
  createItem,
  deleteItem as removeItem,
  updateItem,
} from "@/lib/client-api";
import { normalizeSearchQuery } from "@/lib/search";
import { ItemImageGallery } from "./ItemImageGallery";
import { createEmptyFormEntry, MultiItemForm, type ItemFormEntry } from "./MultiItemForm";

interface ItemListProps {
  items: Item[];
  categories: Category[];
  searchQuery?: string;
  onChanged: () => void;
  onCategoriesChanged: () => void | Promise<void>;
}

const SOURCE_LABEL: Record<Item["source"], string> = {
  ocr: "照片辨識",
  text: "文字解析",
  manual: "手動輸入",
};

export function ItemList({
  items,
  categories,
  searchQuery = "",
  onChanged,
  onCategoriesChanged,
}: ItemListProps) {
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deletingBatchId, setDeletingBatchId] = useState<string | null>(null);
  const [editEntries, setEditEntries] = useState<ItemFormEntry[]>([]);

  const categoryMap = useMemo(
    () => new Map(categories.map((c) => [c.id, c.name])),
    [categories],
  );

  const displayUnits = useMemo(() => buildItemDisplayUnits(items), [items]);

  function startEdit(ids: string[]) {
    const entries: ItemFormEntry[] = ids
      .map((id) => items.find((item) => item.id === id))
      .filter((item): item is Item => item !== undefined)
      .map((item) => ({ key: item.id, initial: item }));

    setEditEntries(entries);
  }

  function cancelEdit() {
    setEditEntries([]);
  }

  function resolveEditBatchId(
    formItems: Array<{ input: ItemInput; options?: ItemSubmitOptions }>,
  ): string | null {
    const namedCount = formItems.filter(({ input }) => input.name.trim()).length;
    if (namedCount <= 1) return null;

    const existingBatchId = editEntries
      .map((entry) => items.find((item) => item.id === entry.key)?.batchId)
      .find((id): id is string => Boolean(id));

    return existingBatchId ?? crypto.randomUUID();
  }

  async function saveEditedItems(
    formItems: Array<{ input: ItemInput; options?: ItemSubmitOptions }>,
  ) {
    const batchId = resolveEditBatchId(formItems);
    const namedCount = formItems.filter(({ input }) => input.name.trim()).length;

    for (let i = 0; i < editEntries.length; i += 1) {
      const entry = editEntries[i];
      const data = formItems[i];
      if (!data?.input.name.trim()) continue;

      const imagePaths = await resolveItemImagePaths(
        data.input.imagePaths,
        data.options,
      );

      const existingItem = items.find((item) => item.id === entry.key);
      const payload: ItemInput & { imagePaths: string[] } = {
        ...data.input,
        imagePaths,
      };

      if (namedCount > 1) {
        payload.batchId = batchId;
      } else if (existingItem?.batchId) {
        payload.batchId = existingItem.batchId;
      }

      if (existingItem) {
        const updated = await updateItem(entry.key, payload);
        if (!updated) throw new Error("更新失敗");
      } else {
        await createItem(payload);
      }
    }

    cancelEdit();
    onChanged();
  }

  async function deleteBatch(batchItems: Item[]) {
    if (!confirm(`確定刪除這組 ${batchItems.length} 項商品？`)) return;
    setDeletingBatchId(batchItems[0]?.batchId ?? batchItems[0]?.id ?? null);
    await Promise.all(batchItems.map((item) => removeItem(item.id)));
    setDeletingBatchId(null);
    onChanged();
  }

  async function deleteItem(item: Item) {
    if (!confirm(`確定刪除「${item.name}」？`)) return;
    setDeletingId(item.id);
    await removeItem(item.id);
    setDeletingId(null);
    onChanged();
  }

  if (items.length === 0) {
    const searching = normalizeSearchQuery(searchQuery).length > 0;

    return (
      <div className="empty-state">
        <div
          className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl text-2xl"
          style={{ background: "var(--accent-soft)" }}
        >
          {searching ? "🔍" : "📦"}
        </div>
        <p className="font-medium">
          {searching ? `找不到「${searchQuery.trim()}」` : "還沒有商品"}
        </p>
        <p className="mt-1.5 text-sm" style={{ color: "var(--muted)" }}>
          {searching
            ? "試試其他關鍵字，或清除搜尋與分類篩選"
            : "點「新增商品」拍照或輸入，開始記錄家裡的東西"}
        </p>
      </div>
    );
  }

  if (editEntries.length > 0) {
    return (
      <div className="card">
        <h3 className="mb-4 font-semibold">
          編輯商品（{editEntries.length} 項）
        </h3>
        <MultiItemForm
          entries={editEntries}
          categories={categories}
          enableOcr
          submitLabel={`儲存 ${editEntries.length} 項修改`}
          onCategoriesChanged={onCategoriesChanged}
          onAddEntry={() => {
            setEditEntries((prev) => [...prev, createEmptyFormEntry("manual")]);
          }}
          onRemoveEntry={(key) => {
            setEditEntries((prev) => {
              const next = prev.filter((entry) => entry.key !== key);
              return next.length ? next : prev;
            });
          }}
          minEntries={1}
          onSubmit={saveEditedItems}
          onCancel={cancelEdit}
        />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {displayUnits.map((unit) =>
        unit.kind === "batch" ? (
          <BatchGroup
            key={unit.batchId}
            items={unit.items}
            categoryMap={categoryMap}
            deletingId={deletingId}
            deletingBatchId={deletingBatchId}
            onEdit={() => startEdit(unit.items.map((item) => item.id))}
            onDeleteBatch={() => void deleteBatch(unit.items)}
            onDeleteItem={(item) => void deleteItem(item)}
            onEditItem={(item) => startEdit([item.id])}
          />
        ) : (
          <ItemCard
            key={unit.item.id}
            item={unit.item}
            categoryMap={categoryMap}
            deleting={deletingId === unit.item.id}
            onEdit={() => startEdit([unit.item.id])}
            onDelete={() => void deleteItem(unit.item)}
          />
        ),
      )}
    </div>
  );
}

function BatchGroup({
  items,
  categoryMap,
  deletingId,
  deletingBatchId,
  onEdit,
  onDeleteBatch,
  onDeleteItem,
  onEditItem,
}: {
  items: Item[];
  categoryMap: Map<string, string>;
  deletingId: string | null;
  deletingBatchId: string | null;
  onEdit: () => void;
  onDeleteBatch: () => void;
  onDeleteItem: (item: Item) => void;
  onEditItem: (item: Item) => void;
}) {
  return (
    <article className="card overflow-hidden">
      <div
        className="mb-3 flex flex-wrap items-center justify-between gap-3 border-b pb-3"
        style={{ borderColor: "var(--border)" }}
      >
        <div>
          <p className="text-xs font-medium" style={{ color: "var(--accent)" }}>
            一起新增
          </p>
          <p className="text-sm font-semibold">{formatBatchLabel(items)}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" className="btn-secondary text-sm" onClick={onEdit}>
            編輯整組
          </button>
          <button
            type="button"
            className="btn-danger text-sm"
            disabled={deletingBatchId === items[0]?.batchId}
            onClick={onDeleteBatch}
          >
            刪除整組
          </button>
        </div>
      </div>

      <div className="space-y-3">
        {items.map((item, index) => (
          <div
            key={item.id}
            className={index > 0 ? "border-t pt-3" : undefined}
            style={index > 0 ? { borderColor: "var(--border)" } : undefined}
          >
            <ItemCard
              item={item}
              categoryMap={categoryMap}
              deleting={deletingId === item.id}
              embedded
              onEdit={() => onEditItem(item)}
              onDelete={() => onDeleteItem(item)}
            />
          </div>
        ))}
      </div>
    </article>
  );
}

function ItemCard({
  item,
  categoryMap,
  deleting,
  embedded = false,
  onEdit,
  onDelete,
}: {
  item: Item;
  categoryMap: Map<string, string>;
  deleting: boolean;
  embedded?: boolean;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const days = getDaysRemaining(item);
  const tone = expiryTone(days);
  const categoryName = item.categoryId ? categoryMap.get(item.categoryId) : null;

  return (
    <article className={embedded ? "group" : "card group"}>
      <div className="flex flex-col gap-4 sm:flex-row">
        {item.imagePaths.length > 0 ? (
          <ItemImageGallery paths={item.imagePaths} alt={item.name} />
        ) : (
          <div
            className="flex h-48 w-full shrink-0 items-center justify-center rounded-xl text-4xl sm:h-56 sm:w-56 sm:text-5xl"
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
              {item.location && (
                <p className="mt-1 text-xs" style={{ color: "var(--muted)" }}>
                  📍 {item.location}
                </p>
              )}
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
              value={
                item.quantity > 0
                  ? `${item.remaining}${item.unit ? ` ${item.unit}` : ""} / ${item.quantity}${item.unit ? ` ${item.unit}` : ""}`
                  : "—"
              }
            />
            <Stat label="價格" value={formatCurrency(item.price)} />
          </dl>

          {item.notes && (
            <p className="mt-2 line-clamp-1 text-xs" style={{ color: "var(--muted)" }}>
              {item.notes}
            </p>
          )}

          <div className="mt-3 flex gap-2 opacity-100 sm:opacity-60 sm:group-hover:opacity-100 transition-opacity">
            <button type="button" className="btn-secondary" onClick={onEdit}>
              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
              編輯
            </button>
            <button
              type="button"
              className="btn-danger"
              disabled={deleting}
              onClick={onDelete}
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
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="stat-box">
      <dt className="text-[11px] leading-none" style={{ color: "var(--muted)" }}>{label}</dt>
      <dd className="mt-1 text-sm font-medium leading-snug tabular-nums">{value}</dd>
    </div>
  );
}
