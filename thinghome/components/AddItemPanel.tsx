"use client";

import { useCallback, useState } from "react";
import type { Category, ItemInput, ItemSubmitOptions, ParsedItemDraft } from "@/lib/types";
import { draftToInput, resolveItemImagePaths } from "@/lib/utils";
import { createEmptyFormEntry, createFormKey, MultiItemForm, type ItemFormEntry } from "./MultiItemForm";
import { OcrUpload, type OcrResult } from "./OcrUpload";

type Tab = "photo" | "text" | "manual";

interface AddItemPanelProps {
  categories: Category[];
  onCreated: () => void;
  onClose: () => void;
  onCategoriesChanged: () => void | Promise<void>;
}

function createEntries(
  initial: ItemInput,
  imagePreview?: string | null,
  ocrFile?: File | null,
  extraCount = 1,
): ItemFormEntry[] {
  const entries: ItemFormEntry[] = [
    {
      key: createFormKey(),
      initial,
      imagePreview: imagePreview ?? null,
      ocrFile: ocrFile ?? null,
    },
  ];
  for (let i = 1; i < extraCount; i += 1) {
    entries.push(createEmptyFormEntry(initial.source ?? "manual"));
  }
  return entries;
}

export function AddItemPanel({
  categories,
  onCreated,
  onClose,
  onCategoriesChanged,
}: AddItemPanelProps) {
  const [tab, setTab] = useState<Tab>("photo");
  const [draft, setDraft] = useState<ParsedItemDraft | null>(null);
  const [textInput, setTextInput] = useState("");
  const [parsing, setParsing] = useState(false);
  const [parseError, setParseError] = useState<string | null>(null);
  const [entries, setEntries] = useState<ItemFormEntry[]>([]);

  function resetDraft() {
    setDraft(null);
    setEntries([]);
  }

  function handleOcrParsed(result: OcrResult) {
    setDraft(result.draft);
    const initial = draftToInput(result.draft, "ocr");
    setEntries(createEntries(initial, result.previewUrl, result.file, 2));
  }

  async function handleParseText() {
    if (!textInput.trim()) return;
    setParsing(true);
    setParseError(null);

    try {
      const res = await fetch("/api/parse", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: textInput }),
      });
      if (!res.ok) throw new Error();
      const { draft: parsed } = (await res.json()) as { draft: ParsedItemDraft };
      setDraft(parsed);
      const initial = draftToInput(parsed, "text");
      setEntries(createEntries(initial, null, null, 2));
    } catch {
      setParseError("解析失敗");
    } finally {
      setParsing(false);
    }
  }

  const startManual = useCallback(() => {
    setEntries(createEntries({ name: "", source: "manual" }, null, null, 2));
  }, []);

  async function saveItems(
    items: Array<{ input: ItemInput; options?: ItemSubmitOptions }>,
  ) {
    const toSave = items
      .map((item, index) => ({ ...item, index }))
      .filter(({ input }) => input.name.trim());
    const batchId = toSave.length > 1 ? crypto.randomUUID() : null;

    for (const { input, options, index } of toSave) {
      const entry = entries[index];
      const addedFiles = [...(options?.addedImageFiles ?? [])];
      if (entry?.ocrFile && !addedFiles.includes(entry.ocrFile)) {
        addedFiles.push(entry.ocrFile);
      }

      const imagePaths = await resolveItemImagePaths(input.imagePaths, {
        removedImagePaths: options?.removedImagePaths,
        addedImageFiles: addedFiles.length ? addedFiles : undefined,
      });

      const res = await fetch("/api/items", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...input, imagePaths, batchId }),
      });
      if (!res.ok) throw new Error("新增失敗");
    }

    onCreated();
    onClose();
  }

  const showForm = tab === "manual" ? entries.length > 0 : entries.length > 0;

  return (
    <div className="modal-overlay p-4">
      <div className="modal-panel max-w-2xl">
        <div className="mb-6 flex items-start justify-between gap-4">
          <div>
            <h2 className="text-xl font-semibold">新增商品</h2>
            <p className="mt-1 text-sm" style={{ color: "var(--muted)" }}>
              可一次新增多項商品，每項可上傳多張照片
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

        <div
          className="mb-6 flex gap-1 rounded-lg p-1"
          style={{ background: "rgba(120, 113, 108, 0.08)" }}
        >
          {(
            [
              ["photo", "📷 拍照"],
              ["text", "📝 文字"],
              ["manual", "✏️ 手動"],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              type="button"
              className={`tab-btn ${tab === key ? "tab-btn--active" : ""}`}
              onClick={() => {
                setTab(key);
                resetDraft();
                if (key === "manual") startManual();
              }}
            >
              {label}
            </button>
          ))}
        </div>

        {tab === "photo" && !showForm && (
          <OcrUpload onParsed={handleOcrParsed} />
        )}

        {tab === "text" && !showForm && (
          <div className="space-y-4">
            <textarea
              className="input min-h-36"
              placeholder="貼上收據或商品資訊，例如：&#10;全聯 鮮奶 1L&#10;2026/06/21&#10;保存期限 7 天&#10;NT$ 89"
              value={textInput}
              onChange={(e) => setTextInput(e.target.value)}
            />
            {parseError && <p className="text-sm text-red-600">{parseError}</p>}
            <button
              type="button"
              className="btn-primary"
              onClick={() => void handleParseText()}
              disabled={parsing || !textInput.trim()}
            >
              {parsing ? "解析中…" : "解析文字"}
            </button>
          </div>
        )}

        {showForm && (
          <div className="space-y-4">
            {draft && (
              <div className="info-banner">
                <p className="font-medium">
                  辨識信心：
                  {draft.confidence === "high"
                    ? "高"
                    : draft.confidence === "medium"
                      ? "中"
                      : "低"}
                  — 請確認或修改後再儲存
                </p>
                {draft.rawText && (
                  <details className="mt-2">
                    <summary className="cursor-pointer">查看原始文字</summary>
                    <pre className="mt-2 whitespace-pre-wrap text-xs opacity-80">
                      {draft.rawText}
                    </pre>
                  </details>
                )}
              </div>
            )}
            <MultiItemForm
              entries={entries}
              categories={categories}
              enableOcr={tab === "photo"}
              submitLabel={
                tab === "manual"
                  ? `新增 ${entries.length} 項商品`
                  : `確認新增 ${entries.length} 項`
              }
              onCategoriesChanged={onCategoriesChanged}
              onAddEntry={() =>
                setEntries((prev) => [
                  ...prev,
                  createEmptyFormEntry(
                    tab === "manual" ? "manual" : tab === "photo" ? "ocr" : "text",
                  ),
                ])
              }
              onRemoveEntry={(key) =>
                setEntries((prev) => prev.filter((entry) => entry.key !== key))
              }
              minEntries={1}
              onSubmit={saveItems}
              onCancel={() => {
                if (tab === "manual") {
                  onClose();
                  return;
                }
                resetDraft();
              }}
            />
          </div>
        )}
      </div>
    </div>
  );
}
