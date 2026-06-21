"use client";

import React from "react";
import type { Category } from "@/lib/types";

interface CategoryFieldProps {
  categories: Category[];
  value: string | null;
  onChange: (categoryId: string | null) => void;
  onCategoriesChanged: () => void | Promise<void>;
}

export function CategoryField({
  categories,
  value,
  onChange,
  onCategoriesChanged,
}: CategoryFieldProps) {
  const [expanded, setExpanded] = React.useState(false);
  const [newName, setNewName] = React.useState("");
  const [adding, setAdding] = React.useState(false);
  const [editingId, setEditingId] = React.useState<string | null>(null);
  const [editName, setEditName] = React.useState("");
  const [savingId, setSavingId] = React.useState<string | null>(null);
  const [deletingId, setDeletingId] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);

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
      const { category } = (await res.json()) as { category: Category };
      setNewName("");
      onChange(category.id);
      await onCategoriesChanged();
    } catch {
      setError("新增分類失敗");
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
      await onCategoriesChanged();
    } catch {
      setError("更新分類失敗");
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
      if (value === category.id) onChange(null);
      await onCategoriesChanged();
    } catch {
      setError("刪除分類失敗");
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <select
          className="input flex-1"
          value={value ?? ""}
          onChange={(e) => onChange(e.target.value || null)}
        >
          <option value="">未分類</option>
          {categories.map((category) => (
            <option key={category.id} value={category.id}>
              {category.name}
            </option>
          ))}
        </select>
        <button
          type="button"
          className="btn-secondary shrink-0 text-sm"
          onClick={() => setExpanded((v) => !v)}
        >
          {expanded ? "收合" : "管理"}
        </button>
      </div>

      {expanded && (
        <div
          className="space-y-3 rounded-xl border p-3"
          style={{ borderColor: "var(--border-strong)" }}
        >
          <form onSubmit={handleAdd} className="flex gap-2">
            <input
              className="input flex-1 text-sm"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="新分類名稱"
            />
            <button
              type="submit"
              className="btn-primary shrink-0 text-sm"
              disabled={adding || !newName.trim()}
            >
              {adding ? "新增中…" : "新增"}
            </button>
          </form>

          {error && <p className="text-xs text-red-600">{error}</p>}

          {categories.length === 0 ? (
            <p className="text-xs" style={{ color: "var(--muted)" }}>
              尚無分類，請在上方新增
            </p>
          ) : (
            <ul className="space-y-1.5">
              {categories.map((category) => (
                <li
                  key={category.id}
                  className="flex items-center justify-between gap-2 rounded-lg px-2 py-1.5"
                  style={{ background: "var(--accent-soft)" }}
                >
                  {editingId === category.id ? (
                    <>
                      <input
                        className="input flex-1 text-sm"
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        autoFocus
                      />
                      <button
                        type="button"
                        className="btn-primary shrink-0 text-xs"
                        disabled={savingId === category.id || !editName.trim()}
                        onClick={() => void handleSaveEdit(category.id)}
                      >
                        儲存
                      </button>
                      <button
                        type="button"
                        className="btn-secondary shrink-0 text-xs"
                        onClick={() => setEditingId(null)}
                      >
                        取消
                      </button>
                    </>
                  ) : (
                    <>
                      <span className="text-sm font-medium">{category.name}</span>
                      <div className="flex gap-1">
                        <button
                          type="button"
                          className="btn-secondary text-xs"
                          onClick={() => {
                            setEditingId(category.id);
                            setEditName(category.name);
                          }}
                        >
                          編輯
                        </button>
                        <button
                          type="button"
                          className="btn-danger text-xs"
                          disabled={deletingId === category.id}
                          onClick={() => void handleDelete(category)}
                        >
                          刪除
                        </button>
                      </div>
                    </>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
