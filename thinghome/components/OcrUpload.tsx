"use client";

import { useCallback, useRef, useState } from "react";
import { runOcrOnFile } from "@/lib/ocr";
import type { ParsedItemDraft } from "@/lib/types";

export interface OcrResult {
  draft: ParsedItemDraft;
  file: File;
  previewUrl: string;
}

interface OcrUploadProps {
  onParsed: (result: OcrResult) => void;
  compact?: boolean;
}

export function OcrUpload({ onParsed, compact = false }: OcrUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);

  const runOcr = useCallback(
    async (file: File) => {
      setLoading(true);
      setProgress(0);
      setStatus("載入 OCR 引擎…");

      const previewUrl = URL.createObjectURL(file);
      setPreview(previewUrl);

      try {
        const draft = await runOcrOnFile(file, ({ progress, status }) => {
          setProgress(progress);
          setStatus(status);
        });
        onParsed({ draft, file, previewUrl });
        setStatus("辨識完成，請確認下方欄位");
      } catch {
        setStatus("辨識失敗，請換張較清楚的照片或改用手動輸入");
      } finally {
        setLoading(false);
      }
    },
    [onParsed],
  );

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) void runOcr(file);
  }

  return (
    <div className="space-y-4">
      <div
        className={
          compact
            ? "flex cursor-pointer flex-col items-center justify-center rounded-xl border border-dashed px-4 py-6 text-center transition hover:border-[var(--accent)] hover:bg-[var(--accent-soft)]"
            : "flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed px-6 py-10 text-center transition hover:border-[var(--accent)] hover:bg-[var(--accent-soft)]"
        }
        style={{ borderColor: "var(--border-strong)", background: "var(--surface)" }}
        onClick={() => inputRef.current?.click()}
        onKeyDown={(e) => e.key === "Enter" && inputRef.current?.click()}
        role="button"
        tabIndex={0}
      >
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={handleFileChange}
          disabled={loading}
        />
        <p className={compact ? "text-sm font-medium" : "text-lg font-medium"}>
          📷 {compact ? "拍照辨識此商品" : "上傳或拍攝收據／標籤照片"}
        </p>
        {!compact && (
          <p className="mt-2 text-sm" style={{ color: "var(--muted)" }}>
            OCR 在本機辨識，照片會存到 data/uploads/
          </p>
        )}
      </div>

      {preview && (
        <img
          src={preview}
          alt="預覽"
          className="max-h-48 w-full rounded-xl object-contain"
          style={{ background: "var(--accent-soft)" }}
        />
      )}

      {loading && (
        <div className="space-y-2">
          <div className="h-2 overflow-hidden rounded-full" style={{ background: "var(--accent-soft)" }}>
            <div
              className="h-full rounded-full transition-all"
              style={{ width: `${progress}%`, background: "var(--accent)" }}
            />
          </div>
          <p className="text-sm" style={{ color: "var(--muted)" }}>{status}</p>
        </div>
      )}

      {!loading && status && (
        <p className="text-sm" style={{ color: "var(--accent)" }}>{status}</p>
      )}
    </div>
  );
}
