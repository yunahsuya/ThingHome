"use client";

import { useRef, useState } from "react";
import {
  bindSyncFolder,
  exportBackupDownload,
  getFolderSyncInfo,
  getLastBackupAt,
  importBackupFromFile,
  isFolderSyncSupported,
  syncFolderNow,
  unbindSyncFolder,
  type FolderSyncInfo,
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

function formatSyncAction(action: string): string {
  switch (action) {
    case "pulled":
      return "已從雲端資料夾載入較新資料";
    case "pushed":
      return "已寫入較新資料到雲端資料夾";
    case "unchanged":
      return "資料已是最新，無需同步";
    default:
      return "";
  }
}

export function BackupPanel({ onClose, onChanged }: BackupPanelProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [lastBackupAt, setLastBackupAt] = useState(getLastBackupAt);
  const [syncInfo, setSyncInfo] = useState<FolderSyncInfo>(getFolderSyncInfo);
  const [exporting, setExporting] = useState(false);
  const [importing, setImporting] = useState(false);
  const [binding, setBinding] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  function refreshSyncInfo() {
    setSyncInfo(getFolderSyncInfo());
    setLastBackupAt(getLastBackupAt());
  }

  async function handleExport() {
    setExporting(true);
    setError(null);
    setMessage(null);
    try {
      await exportBackupDownload();
      refreshSyncInfo();
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
      refreshSyncInfo();
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

  async function handleBindFolder() {
    setBinding(true);
    setError(null);
    setMessage(null);
    try {
      const result = await bindSyncFolder();
      refreshSyncInfo();

      if (result.action === "unsupported") {
        setError("此瀏覽器不支援資料夾同步，請使用 Chrome 或 Edge 電腦版");
        return;
      }
      if (result.action === "permission-denied") {
        setError(result.message ?? "未取得資料夾讀寫權限");
        return;
      }

      const syncMessage = formatSyncAction(result.action);
      setMessage(
        [result.message, syncMessage].filter(Boolean).join("。") ||
          "已綁定同步資料夾",
      );

      if (result.action === "pulled") onChanged();
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") return;
      setError(err instanceof Error ? err.message : "綁定資料夾失敗");
    } finally {
      setBinding(false);
    }
  }

  async function handleSyncNow() {
    setSyncing(true);
    setError(null);
    setMessage(null);
    try {
      const result = await syncFolderNow();
      refreshSyncInfo();

      if (result.action === "no-folder") {
        setError("尚未綁定同步資料夾");
        return;
      }
      if (result.action === "permission-denied") {
        setError(result.message ?? "請重新授權同步資料夾");
        return;
      }

      const syncMessage = formatSyncAction(result.action);
      if (syncMessage) setMessage(syncMessage);
      if (result.action === "pulled") onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : "同步失敗");
    } finally {
      setSyncing(false);
    }
  }

  async function handleUnbindFolder() {
    if (
      !window.confirm(
        "解除綁定後不會刪除資料夾內的備份檔，但 App 將不再自動同步。確定要解除嗎？",
      )
    ) {
      return;
    }

    await unbindSyncFolder();
    refreshSyncInfo();
    setMessage("已解除同步資料夾綁定");
  }

  const folderSyncSupported = isFolderSyncSupported();

  return (
    <div className="modal-overlay p-4">
      <div className="modal-panel max-w-lg">
        <div className="mb-6 flex items-start justify-between gap-4">
          <div>
            <h2 className="text-xl font-semibold">資料備份與同步</h2>
            <p className="mt-1 text-sm" style={{ color: "var(--muted)" }}>
              匯出 JSON 備份，或綁定雲端同步資料夾自動同步
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
          className="mb-4 rounded-xl border p-4 text-sm leading-relaxed"
          style={{
            borderColor: "var(--border-strong)",
            background: "var(--surface-raised)",
            color: "var(--muted)",
          }}
        >
          <p className="font-medium" style={{ color: "var(--foreground)" }}>
            雲端資料夾同步
          </p>
          <p className="mt-2">
            選擇 OneDrive、iCloud 雲碟或 Google 雲端硬碟內的資料夾，App
            會自動讀寫 <strong style={{ color: "var(--foreground)" }}>thinghome-backup.json</strong>
            ，由作業系統幫你同步到其他裝置。
          </p>
          {!folderSyncSupported && (
            <p className="mt-2 text-amber-700">
              目前瀏覽器不支援此功能，請使用 Chrome 或 Edge 電腦版。
            </p>
          )}
          {syncInfo.bound && syncInfo.folderName && (
            <p className="mt-2">
              已綁定：<strong style={{ color: "var(--foreground)" }}>{syncInfo.folderName}</strong>
            </p>
          )}
          {syncInfo.bound && (
            <p className="mt-1">上次同步：{formatBackupTime(syncInfo.lastSyncAt)}</p>
          )}
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              className="btn-primary"
              disabled={!folderSyncSupported || binding || syncing}
              onClick={() => void handleBindFolder()}
            >
              {binding
                ? "綁定中…"
                : syncInfo.bound
                  ? "更換資料夾"
                  : "選擇同步資料夾"}
            </button>
            {syncInfo.bound && (
              <>
                <button
                  type="button"
                  className="btn-secondary"
                  disabled={syncing || binding}
                  onClick={() => void handleSyncNow()}
                >
                  {syncing ? "同步中…" : "立即同步"}
                </button>
                <button
                  type="button"
                  className="btn-secondary"
                  disabled={binding || syncing}
                  onClick={() => void handleUnbindFolder()}
                >
                  解除綁定
                </button>
              </>
            )}
          </div>
        </div>

        <div
          className="mb-6 rounded-xl border p-4 text-sm leading-relaxed"
          style={{
            borderColor: "var(--border-strong)",
            background: "var(--surface-raised)",
            color: "var(--muted)",
          }}
        >
          <p className="font-medium" style={{ color: "var(--foreground)" }}>
            手動備份
          </p>
          <p className="mt-2">瀏覽器內的資料在清除網站資料後會消失。</p>
          <p className="mt-2">
            也可手動匯出 <strong style={{ color: "var(--foreground)" }}>thinghome-backup.json</strong>{" "}
            存到雲端或電腦，需要時再匯入還原。
          </p>
          <p className="mt-2">上次備份：{formatBackupTime(lastBackupAt)}</p>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className="btn-secondary"
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
