"use client";

import { useState } from "react";
import type { Category, ItemInput, ItemSubmitOptions, ParsedItemDraft } from "@/lib/types";
import { draftToInput, uploadImageFile } from "@/lib/utils";
import { ItemForm } from "./ItemForm";
import { OcrUpload, type OcrResult } from "./OcrUpload";

type Tab = "photo" | "text" | "manual";

interface AddItemPanelProps {
  categories: Category[];
  onCreated: () => void;
  onClose: () => void;
}

export function AddItemPanel({ categories, onCreated, onClose }: AddItemPanelProps) {
  const [tab, setTab] = useState<Tab>("photo");
  const [draft, setDraft] = useState<ParsedItemDraft | null>(null);
  const [ocrFile, setOcrFile] = useState<File | null>(null);
  const [ocrPreview, setOcrPreview] = useState<string | null>(null);
  const [textInput, setTextInput] = useState("");
  const [parsing, setParsing] = useState(false);
  const [parseError, setParseError] = useState<string | null>(null);

  function resetDraft() {
    setDraft(null);
    setOcrFile(null);
    if (ocrPreview?.startsWith("blob:")) {
      URL.revokeObjectURL(ocrPreview);
    }
    setOcrPreview(null);
  }

  function handleOcrParsed(result: OcrResult) {
    setDraft(result.draft);
    setOcrFile(result.file);
    setOcrPreview(result.previewUrl);
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
    } catch {
      setParseError("解析失敗");
    } finally {
      setParsing(false);
    }
  }

  async function saveItem(input: ItemInput, options?: ItemSubmitOptions) {
    let imagePath = input.imagePath ?? null;

    if (options?.removeImage) {
      imagePath = null;
    } else if (options?.imageFile) {
      imagePath = await uploadImageFile(options.imageFile);
    } else if (ocrFile && tab === "photo") {
      imagePath = await uploadImageFile(ocrFile);
    }

    const res = await fetch("/api/items", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...input, imagePath }),
    });
    if (!res.ok) throw new Error("新增失敗");
    onCreated();
    onClose();
  }

  const formInitial: ItemInput | null = draft
    ? draftToInput(draft, tab === "photo" ? "ocr" : "text")
    : tab === "manual"
      ? { name: "", source: "manual" }
      : null;

  return (
    <div className="modal-overlay p-4">
      <div className="modal-panel max-w-2xl">
        <div className="mb-6 flex items-start justify-between gap-4">
          <div>
            <h2 className="text-xl font-semibold">新增商品</h2>
            <p className="mt-1 text-sm" style={{ color: "var(--muted)" }}>
              拍照辨識、貼文字或手動輸入，確認後儲存
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
              }}
            >
              {label}
            </button>
          ))}
        </div>

        {tab === "photo" && !formInitial && (
          <OcrUpload onParsed={handleOcrParsed} />
        )}

        {tab === "text" && !formInitial && (
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

        {formInitial && (
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
            <ItemForm
              initial={formInitial}
              categories={categories}
              imagePreview={ocrPreview}
              submitLabel={tab === "manual" ? "新增商品" : "確認新增"}
              onSubmit={saveItem}
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
