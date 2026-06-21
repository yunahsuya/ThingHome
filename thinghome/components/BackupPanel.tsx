"use client";

import { useRef, useState } from "react";
import {
  exportBackupDownload,
  getLastBackupAt,
  importBackupFromFile,
  isAutoBackupEnabled,
  setAutoBackupEnabled,
} from "@/lib/client-api";

interface BackupPanelProps {
  onClose: () => void;
  onChanged: () => void;
}

function formatBackupTime(iso: string | null): string {
  if (!iso) return "尚未備份";
  try {
    return new Date(iso).toLocaleString("zh-TW");
  } catch {
    return iso;
  }
}

export function BackupPanel({ onClose, onChanged }: BackupPanelProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [autoBackup, setAutoBackup] = useState(isAutoBackupEnabled);
  const [lastBackupAt, setLastBackupAt] = useState(getLastBackupAt);
  const [exporting, setExporting] = useState(false);
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function handleExport() {
    setExporting(true);
    setError(null);
    setMessage(null);
    try {
      await exportBackupDownload();
      setLastBackupAt(getLastBackupAt());
      setMessage("已下載 thinghome-backup.json");
    } catch {
      setError("匯出失敗，請稍後再試");
    } finally {
      setExporting(false);
    }
  }

  async function handleImport(file: File, mode: "merge" | "replace") {
    setImporting(true);
    setError(null);
    setMessage(null);
    try {
      const result = await importBackupFromFile(file, mode);
      setLastBackupAt(getLastBackupAt());
      setMessage(
        `已還原：新增 ${result.itemsAdded} 筆商品、${result.categoriesAdded} 個分類`,
      );
      onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : "匯入失敗，請確認檔案格式");
    } finally {
      setImporting(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  function handleAutoBackupChange(enabled: boolean) {
    setAutoBackup(enabled);
    setAutoBackupEnabled(enabled);
    setMessage(enabled ? "已開啟：每次變更會自動下載 JSON 備份" : "已關閉自動下載備份");
  }

  return (
    <div className="modal-overlay p-4">
      <div className="modal-panel max-w-lg">
        <div className="mb-6 flex items-start justify-between gap-4">
          <div>
            <h2 className="text-xl font-semibold">資料備份</h2>
            <p className="mt-1 text-sm" style={{ color: "var(--muted)" }}>
              匯出成 JSON 檔，清除瀏覽器資料後仍可還原
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
          className="mb-6 rounded-xl border p-4 text-sm leading-relaxed"
          style={{
            borderColor: "var(--border-strong)",
            background: "var(--surface-raised)",
            color: "var(--muted)",
          }}
        >
          <p>瀏覽器內的資料在清除網站資料後會消失。</p>
          <p className="mt-2">
            建議把 <strong style={{ color: "var(--foreground)" }}>thinghome-backup.json</strong>{" "}
            存到 iCloud、Google 雲端硬碟或電腦，需要時再匯入還原。
          </p>
          <p className="mt-2">上次備份：{formatBackupTime(lastBackupAt)}</p>
        </div>

        <label className="mb-6 flex cursor-pointer items-start gap-3">
          <input
            type="checkbox"
            className="mt-1"
            checked={autoBackup}
            onChange={(e) => handleAutoBackupChange(e.target.checked)}
          />
          <span className="text-sm">
            <span className="font-medium">自動下載 JSON 備份</span>
            <span className="mt-1 block" style={{ color: "var(--muted)" }}>
              每次新增、修改或刪除後，約 1.5 秒自動下載一份備份檔
            </span>
          </span>
        </label>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className="btn-primary"
            disabled={exporting}
            onClick={() => void handleExport()}
          >
            {exporting ? "匯出中…" : "立即匯出 JSON"}
          </button>
          <button
            type="button"
            className="btn-secondary"
            disabled={importing}
            onClick={() => fileInputRef.current?.click()}
          >
            {importing ? "匯入中…" : "從 JSON 還原（合併）"}
          </button>
          <button
            type="button"
            className="btn-secondary"
            disabled={importing}
            onClick={() => {
              if (
                !window.confirm(
                  "將以備份檔覆蓋目前所有商品與分類，確定要繼續嗎？",
                )
              ) {
                return;
              }
              fileInputRef.current?.setAttribute("data-mode", "replace");
              fileInputRef.current?.click();
            }}
          >
            完整覆蓋還原
          </button>
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept="application/json,.json"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (!file) return;
            const mode =
              e.target.getAttribute("data-mode") === "replace"
                ? "replace"
                : "merge";
            e.target.removeAttribute("data-mode");
            void handleImport(file, mode);
          }}
        />

        {message && <p className="mt-4 text-sm text-green-700">{message}</p>}
        {error && <p className="mt-4 text-sm text-red-600">{error}</p>}
      </div>
    </div>
  );
}
