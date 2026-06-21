"use client";

import { useCallback, useEffect, useState } from "react";
import type { Category } from "@/lib/types";

interface CategoryPanelProps {
  onClose: () => void;
  onChanged: () => void;
}

export function CategoryPanel({ onClose, onChanged }: CategoryPanelProps) {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [newName, setNewName] = useState("");
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [savingId, setSavingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadCategories = useCallback(async () => {
    const res = await fetch("/api/categories");
    const data = (await res.json()) as { categories: Category[] };
    setCategories(data.categories);
    setLoading(false);
  }, []);

  useEffect(() => {
    void loadCategories();
  }, [loadCategories]);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!newName.trim()) return;

    setAdding(true);
    setError(null);
    try {
      const res = await fetch("/api/categories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newName.trim() }),
      });
      if (!res.ok) throw new Error("新增失敗");
      setNewName("");
      await loadCategories();
      onChanged();
    } catch {
      setError("新增分類失敗，請稍後再試");
    } finally {
      setAdding(false);
    }
  }

  async function handleSaveEdit(id: string) {
    if (!editName.trim()) return;

    setSavingId(id);
    setError(null);
    try {
      const res = await fetch(`/api/categories/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: editName.trim() }),
      });
      if (!res.ok) throw new Error("更新失敗");
      setEditingId(null);
      await loadCategories();
      onChanged();
    } catch {
      setError("更新分類失敗，請稍後再試");
    } finally {
      setSavingId(null);
    }
  }

  async function handleDelete(category: Category) {
    if (!confirm(`確定刪除分類「${category.name}」？\n相關商品將變為未分類。`)) {
      return;
    }

    setDeletingId(category.id);
    setError(null);
    try {
      const res = await fetch(`/api/categories/${category.id}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("刪除失敗");
      await loadCategories();
      onChanged();
    } catch {
      setError("刪除分類失敗，請稍後再試");
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className="modal-overlay p-4">
      <div className="modal-panel max-w-lg">
        <div className="mb-6 flex items-start justify-between gap-4">
          <div>
            <h2 className="text-xl font-semibold">管理分類</h2>
            <p className="mt-1 text-sm" style={{ color: "var(--muted)" }}>
              新增、編輯或刪除商品分類
            </p>
          </div>
          <button
            type="button"
            className="btn-ghost"
            onClick={onClose}
            aria-label="關閉"
          >
            ✕
          </button>
        </div>

        <form onSubmit={handleAdd} className="mb-6 flex gap-2">
          <input
            className="input flex-1"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="新分類名稱，例如：廚房"
          />
          <button
            type="submit"
            className="btn-primary shrink-0"
            disabled={adding || !newName.trim()}
          >
            {adding ? "新增中…" : "新增"}
          </button>
        </form>

        {error && <p className="mb-4 text-sm text-red-600">{error}</p>}

        {loading ? (
          <div className="flex justify-center py-10">
            <div
              className="h-7 w-7 animate-spin rounded-full border-2 border-t-transparent"
              style={{
                borderColor: "var(--accent)",
                borderTopColor: "transparent",
              }}
            />
          </div>
        ) : categories.length === 0 ? (
          <div className="empty-state py-10">
            <p className="font-medium">還沒有分類</p>
            <p className="mt-1.5 text-sm" style={{ color: "var(--muted)" }}>
              在上方輸入名稱，建立第一個分類
            </p>
          </div>
        ) : (
          <ul className="space-y-2">
            {categories.map((category) => (
              <li key={category.id} className="card !p-3">
                {editingId === category.id ? (
                  <div className="flex gap-2">
                    <input
                      className="input flex-1"
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      autoFocus
                    />
                    <button
                      type="button"
                      className="btn-primary shrink-0"
                      disabled={savingId === category.id || !editName.trim()}
                      onClick={() => void handleSaveEdit(category.id)}
                    >
                      {savingId === category.id ? "儲存中…" : "儲存"}
                    </button>
                    <button
                      type="button"
                      className="btn-secondary shrink-0"
                      onClick={() => setEditingId(null)}
                    >
                      取消
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center justify-between gap-3">
                    <span className="font-medium">{category.name}</span>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        className="btn-secondary"
                        onClick={() => {
                          setEditingId(category.id);
                          setEditName(category.name);
                        }}
                      >
                        編輯
                      </button>
                      <button
                        type="button"
                        className="btn-danger"
                        disabled={deletingId === category.id}
                        onClick={() => void handleDelete(category)}
                      >
                        刪除
                      </button>
                    </div>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
