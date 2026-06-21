"use client";

import { useCallback, useEffect, useState } from "react";
import type { Item } from "@/lib/types";
import { getDaysRemaining } from "@/lib/parse-text";
import { AddItemPanel } from "./AddItemPanel";
import { ItemList } from "./ItemList";

export function HomeClient() {
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);

  const loadItems = useCallback(async () => {
    const res = await fetch("/api/items");
    const data = (await res.json()) as { items: Item[] };
    setItems(data.items);
    setLoading(false);
  }, []);

  useEffect(() => {
    void loadItems();
  }, [loadItems]);

  const expiringSoon = items.filter((item) => {
    const days = getDaysRemaining(item);
    return days !== null && days >= 0 && days <= 7;
  }).length;

  const expired = items.filter((item) => {
    const days = getDaysRemaining(item);
    return days !== null && days < 0;
  }).length;

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-1 flex-col px-4 py-8 sm:px-6">
      <header className="mb-8">
        <p className="text-sm font-medium text-emerald-600 dark:text-emerald-400">
          ThingHome
        </p>
        <h1 className="mt-1 text-3xl font-bold tracking-tight">居家物品管理</h1>
        <p className="mt-2 max-w-xl text-zinc-600 dark:text-zinc-400">
          拍照或貼文字自動辨識商品，記錄購買日期、期限、剩餘數量與價格。
          之後可串接 LINE / Discord Bot 使用同一套 API。
        </p>
      </header>

      <section className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <SummaryCard label="全部商品" value={String(items.length)} />
        <SummaryCard label="7 天內到期" value={String(expiringSoon)} warn />
        <SummaryCard label="已過期" value={String(expired)} danger={expired > 0} />
      </section>

      <div className="mb-6 flex items-center justify-between gap-4">
        <h2 className="text-lg font-semibold">我的商品</h2>
        <button type="button" className="btn-primary" onClick={() => setShowAdd(true)}>
          ＋ 新增商品
        </button>
      </div>

      {loading ? (
        <p className="text-center text-zinc-500">載入中…</p>
      ) : (
        <ItemList items={items} onChanged={loadItems} />
      )}

      {showAdd && (
        <AddItemPanel
          onCreated={() => void loadItems()}
          onClose={() => setShowAdd(false)}
        />
      )}
    </div>
  );
}

function SummaryCard({
  label,
  value,
  warn,
  danger,
}: {
  label: string;
  value: string;
  warn?: boolean;
  danger?: boolean;
}) {
  return (
    <div className="card">
      <p className="text-sm text-zinc-500">{label}</p>
      <p
        className={`mt-1 text-3xl font-bold ${
          danger
            ? "text-red-600"
            : warn
              ? "text-amber-600"
              : "text-zinc-900 dark:text-zinc-50"
        }`}
      >
        {value}
      </p>
    </div>
  );
}
