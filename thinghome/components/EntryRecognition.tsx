"use client";

import { useState } from "react";
import type { ItemInput, ParsedItemDraft } from "@/lib/types";
import { draftToInput } from "@/lib/utils";
import { OcrUpload, type OcrResult } from "./OcrUpload";

type RecognitionMode = "photo" | "text";

interface EntryRecognitionProps {
  mode: RecognitionMode;
  onRecognized: (result: {
    initial: ItemInput;
    imagePreview?: string | null;
    ocrFile?: File | null;
    draft: ParsedItemDraft;
  }) => void;
}

export function EntryRecognition({ mode, onRecognized }: EntryRecognitionProps) {
  const [textInput, setTextInput] = useState("");
  const [parsing, setParsing] = useState(false);
  const [parseError, setParseError] = useState<string | null>(null);

  function handleOcrParsed(result: OcrResult) {
    onRecognized({
      initial: draftToInput(result.draft, "ocr"),
      imagePreview: result.previewUrl,
      ocrFile: result.file,
      draft: result.draft,
    });
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
      const { draft } = (await res.json()) as { draft: ParsedItemDraft };
      onRecognized({
        initial: draftToInput(draft, "text"),
        draft,
      });
    } catch {
      setParseError("解析失敗");
    } finally {
      setParsing(false);
    }
  }

  if (mode === "photo") {
    return <OcrUpload compact onParsed={handleOcrParsed} />;
  }

  return (
    <div className="space-y-3">
      <textarea
        className="input min-h-24 text-sm"
        placeholder="貼上此商品的收據或標籤文字…"
        value={textInput}
        onChange={(e) => setTextInput(e.target.value)}
      />
      {parseError && <p className="text-xs text-red-600">{parseError}</p>}
      <button
        type="button"
        className="btn-secondary text-sm"
        onClick={() => void handleParseText()}
        disabled={parsing || !textInput.trim()}
      >
        {parsing ? "解析中…" : "解析此項文字"}
      </button>
    </div>
  );
}

export function RecognitionBanner({ draft }: { draft: ParsedItemDraft }) {
  return (
    <div className="info-banner !py-2 !text-sm">
      <p>
        辨識信心：
        {draft.confidence === "high"
          ? "高"
          : draft.confidence === "medium"
            ? "中"
            : "低"}
        — 請確認下方欄位
      </p>
      {draft.rawText && (
        <details className="mt-1">
          <summary className="cursor-pointer text-xs">查看原始文字</summary>
          <pre className="mt-1 whitespace-pre-wrap text-xs opacity-80">
            {draft.rawText}
          </pre>
        </details>
      )}
    </div>
  );
}
