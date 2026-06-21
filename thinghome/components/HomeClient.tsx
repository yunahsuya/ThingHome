"use client";

import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import type { Category, Item } from "@/lib/types";
import { getDaysRemaining } from "@/lib/parse-text";
import { filterItemsBySearch, normalizeSearchQuery } from "@/lib/search";
import { AddItemPanel } from "./AddItemPanel";
import { CategoryPanel } from "./CategoryPanel";
import { ItemList } from "./ItemList";

export function HomeClient() {
  const [items, setItems] = useState<Item[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [showCategories, setShowCategories] = useState(false);
  const [filterCategoryId, setFilterCategoryId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  const loadItems = useCallback(async () => {
    const res = await fetch("/api/items");
    const data = (await res.json()) as { items: Item[] };
    setItems(data.items);
    setLoading(false);
  }, []);

  const loadCategories = useCallback(async () => {
    const res = await fetch("/api/categories");
    const data = (await res.json()) as { categories: Category[] };
    setCategories(data.categories);
  }, []);

  const loadAll = useCallback(async () => {
    await Promise.all([loadItems(), loadCategories()]);
  }, [loadItems, loadCategories]);

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  const categoryMap = useMemo(
    () => new Map(categories.map((category) => [category.id, category.name])),
    [categories],
  );

  const categoryFilteredItems = useMemo(() => {
    if (filterCategoryId === null) return items;
    if (filterCategoryId === "uncategorized") {
      return items.filter((item) => !item.categoryId);
    }
    return items.filter((item) => item.categoryId === filterCategoryId);
  }, [items, filterCategoryId]);

  const filteredItems = useMemo(
    () => filterItemsBySearch(categoryFilteredItems, searchQuery, categoryMap),
    [categoryFilteredItems, searchQuery, categoryMap],
  );

  const isSearching = normalizeSearchQuery(searchQuery).length > 0;

  const expiringSoon = items.filter((item) => {
    const days = getDaysRemaining(item);
    return days !== null && days >= 0 && days <= 7;
  }).length;

  const expired = items.filter((item) => {
    const days = getDaysRemaining(item);
    return days !== null && days < 0;
  }).length;

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col px-4 py-6 sm:px-6 sm:py-10">
      <header className="mb-8">
        <div className="inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-medium"
          style={{ borderColor: "var(--border-strong)", background: "var(--accent-soft)", color: "var(--accent)" }}>
          <span className="h-1.5 w-1.5 rounded-full bg-current" />
          ThingHome
        </div>
        <h1 className="mt-4 text-2xl font-bold tracking-tight sm:text-3xl">
          居家物品管理
        </h1>
        <p className="mt-2 max-w-md text-sm leading-relaxed" style={{ color: "var(--muted)" }}>
          拍照或貼文字自動辨識商品，記錄購買日期、期限、剩餘數量與價格。
        </p>
      </header>

      <section className="mb-8 grid grid-cols-3 gap-3">
        <SummaryCard
          label="全部商品"
          value={String(items.length)}
          icon={
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
            </svg>
          }
        />
        <SummaryCard
          label="7 天內到期"
          value={String(expiringSoon)}
          warn
          icon={
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          }
        />
        <SummaryCard
          label="已過期"
          value={String(expired)}
          danger={expired > 0}
          icon={
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          }
        />
      </section>

      <div className="mb-4 flex items-center justify-between gap-4">
        <h2 className="text-base font-semibold">我的商品</h2>
        <div className="flex gap-2">
          <button
            type="button"
            className="btn-secondary"
            onClick={() => setShowCategories(true)}
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A2 2 0 013 12V7a4 4 0 014-4z" />
            </svg>
            管理分類
          </button>
          <button type="button" className="btn-primary" onClick={() => setShowAdd(true)}>
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
            新增商品
          </button>
        </div>
      </div>

      <div className="relative mb-4">
        <svg
          className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2"
          style={{ color: "var(--muted)" }}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
          aria-hidden
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M21 21l-4.35-4.35M10.5 18a7.5 7.5 0 100-15 7.5 7.5 0 000 15z"
          />
        </svg>
        <input
          type="search"
          className="search-input"
          placeholder="搜尋商品名稱、位置、備註、分類…"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
        {searchQuery && (
          <button
            type="button"
            className="btn-ghost absolute right-1 top-1/2 -translate-y-1/2"
            onClick={() => setSearchQuery("")}
            aria-label="清除搜尋"
          >
            ✕
          </button>
        )}
      </div>

      {isSearching && !loading && (
        <p className="mb-3 text-sm" style={{ color: "var(--muted)" }}>
          找到 {filteredItems.length} 項
          {filterCategoryId !== null ? "（已套用分類篩選）" : ""}
        </p>
      )}

      {categories.length > 0 && (
        <div className="mb-4 flex flex-wrap gap-2">
          <FilterChip
            label="全部"
            active={filterCategoryId === null}
            count={items.length}
            onClick={() => setFilterCategoryId(null)}
          />
          {categories.map((category) => (
            <FilterChip
              key={category.id}
              label={category.name}
              active={filterCategoryId === category.id}
              count={items.filter((item) => item.categoryId === category.id).length}
              onClick={() => setFilterCategoryId(category.id)}
            />
          ))}
          {items.some((item) => !item.categoryId) && (
            <FilterChip
              label="未分類"
              active={filterCategoryId === "uncategorized"}
              count={items.filter((item) => !item.categoryId).length}
              onClick={() => setFilterCategoryId("uncategorized")}
            />
          )}
        </div>
      )}

      {loading ? (
        <div className="flex flex-col items-center gap-3 py-16">
          <div
            className="h-8 w-8 animate-spin rounded-full border-2 border-t-transparent"
            style={{ borderColor: "var(--accent)", borderTopColor: "transparent" }}
          />
          <p className="text-sm" style={{ color: "var(--muted)" }}>載入中…</p>
        </div>
      ) : (
        <ItemList
          items={filteredItems}
          categories={categories}
          searchQuery={searchQuery}
          onChanged={loadAll}
          onCategoriesChanged={loadCategories}
        />
      )}

      {showAdd && (
        <AddItemPanel
          categories={categories}
          onCreated={() => void loadAll()}
          onClose={() => setShowAdd(false)}
          onCategoriesChanged={loadCategories}
        />
      )}

      {showCategories && (
        <CategoryPanel
          onChanged={() => void loadAll()}
          onClose={() => setShowCategories(false)}
        />
      )}
    </div>
  );
}

function FilterChip({
  label,
  active,
  count,
  onClick,
}: {
  label: string;
  active: boolean;
  count: number;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition"
      style={
        active
          ? {
              background: "var(--accent)",
              color: "white",
            }
          : {
              background: "var(--surface-raised)",
              border: "1px solid var(--border-strong)",
              color: "var(--foreground)",
            }
      }
    >
      {label}
      <span
        className="rounded-full px-1.5 py-0.5 text-[10px] tabular-nums"
        style={
          active
            ? { background: "rgba(255,255,255,0.25)" }
            : { background: "var(--accent-soft)", color: "var(--accent)" }
        }
      >
        {count}
      </span>
    </button>
  );
}

function SummaryCard({
  label,
  value,
  icon,
  warn,
  danger,
}: {
  label: string;
  value: string;
  icon: ReactNode;
  warn?: boolean;
  danger?: boolean;
}) {
  const variant = danger ? "summary-card--danger" : warn ? "summary-card--warn" : "";
  const valueColor = danger ? "var(--danger)" : warn ? "var(--warn)" : "var(--foreground)";

  return (
    <div className={`summary-card ${variant}`}>
      <div className="flex items-center gap-1.5 text-xs" style={{ color: "var(--muted)" }}>
        <span style={{ color: valueColor, opacity: 0.8 }}>{icon}</span>
        <span className="truncate">{label}</span>
      </div>
      <p className="mt-2 text-2xl font-bold tabular-nums sm:text-3xl" style={{ color: valueColor }}>
        {value}
      </p>
    </div>
  );
}
