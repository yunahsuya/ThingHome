import { parseBackupFile, type ThingHomeBackup } from "@/lib/backup";

export const DEFAULT_GITHUB_REPO = "yunahsuya/ThingHome";
export const DEFAULT_GITHUB_PATH = "thinghome/sync/thinghome-backup.json";

const GITHUB_TOKEN_KEY = "thinghome:github-token";
const GITHUB_REPO_KEY = "thinghome:github-repo";
const GITHUB_PATH_KEY = "thinghome:github-path";
const LAST_GITHUB_SYNC_KEY = "thinghome:last-github-sync-at";

type GitHubSyncAction =
  | "pulled"
  | "pushed"
  | "unchanged"
  | "not-configured"
  | "auth-failed"
  | "error";

export interface GitHubSyncResult {
  action: GitHubSyncAction;
  message?: string;
  localAt?: string;
  remoteAt?: string;
}

export interface GitHubSyncConfig {
  token: string;
  repo: string;
  path: string;
}

export interface GitHubSyncInfo {
  configured: boolean;
  repo: string | null;
  path: string | null;
  lastSyncAt: string | null;
  hasToken: boolean;
}

interface GitHubContentResponse {
  content?: string;
  sha?: string;
  message?: string;
}

function toBase64Utf8(text: string): string {
  const bytes = new TextEncoder().encode(text);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function fromBase64Utf8(base64: string): string {
  const normalized = base64.replace(/\s/g, "");
  const binary = atob(normalized);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new TextDecoder().decode(bytes);
}

function parseRepo(repo: string): { owner: string; name: string } | null {
  const trimmed = repo.trim();
  const match = trimmed.match(/^([^/]+)\/([^/]+)$/);
  if (!match) return null;
  return { owner: match[1], name: match[2] };
}

function setLastSyncAt(iso: string) {
  localStorage.setItem(LAST_GITHUB_SYNC_KEY, iso);
}

function githubHeaders(token: string): HeadersInit {
  return {
    Authorization: `Bearer ${token}`,
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
  };
}

async function readGitHubError(res: Response): Promise<string> {
  try {
    const data = (await res.json()) as { message?: string };
    if (data.message) return data.message;
  } catch {
    // ignore
  }
  return `GitHub API 錯誤（${res.status}）`;
}

export function getGitHubSyncInfo(): GitHubSyncInfo {
  return {
    configured: Boolean(localStorage.getItem(GITHUB_TOKEN_KEY)),
    repo: localStorage.getItem(GITHUB_REPO_KEY),
    path: localStorage.getItem(GITHUB_PATH_KEY),
    lastSyncAt: localStorage.getItem(LAST_GITHUB_SYNC_KEY),
    hasToken: Boolean(localStorage.getItem(GITHUB_TOKEN_KEY)),
  };
}

export function getGitHubSyncConfig(): GitHubSyncConfig | null {
  const token = localStorage.getItem(GITHUB_TOKEN_KEY);
  if (!token) return null;

  return {
    token,
    repo: localStorage.getItem(GITHUB_REPO_KEY) ?? DEFAULT_GITHUB_REPO,
    path: localStorage.getItem(GITHUB_PATH_KEY) ?? DEFAULT_GITHUB_PATH,
  };
}

export function saveGitHubSyncConfig(input: {
  token: string;
  repo?: string;
  path?: string;
}): void {
  const existingToken = localStorage.getItem(GITHUB_TOKEN_KEY);
  const token = input.token.trim() || existingToken || "";
  if (!token) throw new Error("請輸入 GitHub Token");

  const repo = (input.repo?.trim() || DEFAULT_GITHUB_REPO).replace(/\.git$/, "");
  if (!parseRepo(repo)) {
    throw new Error("儲存庫格式應為 owner/repo，例如 yunahsuya/ThingHome");
  }

  const path = (input.path?.trim() || DEFAULT_GITHUB_PATH).replace(/^\/+/, "");
  if (!path) throw new Error("請輸入檔案路徑");

  localStorage.setItem(GITHUB_TOKEN_KEY, token);
  localStorage.setItem(GITHUB_REPO_KEY, repo);
  localStorage.setItem(GITHUB_PATH_KEY, path);
}

export function disconnectGitHubSync(): void {
  localStorage.removeItem(GITHUB_TOKEN_KEY);
  localStorage.removeItem(GITHUB_REPO_KEY);
  localStorage.removeItem(GITHUB_PATH_KEY);
  localStorage.removeItem(LAST_GITHUB_SYNC_KEY);
}

async function fetchBackupFromGitHub(
  config: GitHubSyncConfig,
): Promise<{ backup: ThingHomeBackup; sha: string } | null> {
  const parsed = parseRepo(config.repo);
  if (!parsed) throw new Error("儲存庫格式不正確");

  const encodedPath = config.path
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/");

  const res = await fetch(
    `https://api.github.com/repos/${parsed.owner}/${parsed.name}/contents/${encodedPath}`,
    { headers: githubHeaders(config.token) },
  );

  if (res.status === 404) return null;
  if (res.status === 401) {
    throw Object.assign(new Error("GitHub Token 無效或已過期"), {
      code: "auth-failed",
    });
  }
  if (!res.ok) throw new Error(await readGitHubError(res));

  const data = (await res.json()) as GitHubContentResponse;
  if (!data.content || !data.sha) {
    throw new Error("無法讀取 GitHub 備份檔內容");
  }

  const text = fromBase64Utf8(data.content);
  return {
    backup: parseBackupFile(JSON.parse(text) as unknown),
    sha: data.sha,
  };
}

async function pushBackupToGitHub(
  config: GitHubSyncConfig,
  backup: ThingHomeBackup,
  sha?: string,
): Promise<void> {
  const parsed = parseRepo(config.repo);
  if (!parsed) throw new Error("儲存庫格式不正確");

  const encodedPath = config.path
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/");

  const body: Record<string, string> = {
    message: `ThingHome sync ${backup.exportedAt}`,
    content: toBase64Utf8(JSON.stringify(backup, null, 2)),
  };
  if (sha) body.sha = sha;

  const res = await fetch(
    `https://api.github.com/repos/${parsed.owner}/${parsed.name}/contents/${encodedPath}`,
    {
      method: "PUT",
      headers: {
        ...githubHeaders(config.token),
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    },
  );

  if (res.status === 401) {
    throw Object.assign(new Error("GitHub Token 無效或已過期"), {
      code: "auth-failed",
    });
  }
  if (res.status === 403) {
    throw new Error("Token 沒有寫入此儲存庫的權限");
  }
  if (!res.ok) throw new Error(await readGitHubError(res));
}

export async function syncWithGitHub(options: {
  localBackup: ThingHomeBackup;
  localTimestamp: string;
  applyRemote: (backup: ThingHomeBackup) => Promise<void>;
}): Promise<GitHubSyncResult> {
  const config = getGitHubSyncConfig();
  if (!config) return { action: "not-configured" };

  try {
    const remoteFile = await fetchBackupFromGitHub(config);
    const remote = remoteFile?.backup ?? null;
    const remoteAt = remote?.exportedAt ?? null;
    const localAt = options.localTimestamp;

    const hasLocalData =
      options.localBackup.items.length > 0 ||
      options.localBackup.categories.length > 0;

    if (!remote) {
      if (!hasLocalData) {
        setLastSyncAt(new Date().toISOString());
        return { action: "unchanged", localAt, remoteAt: undefined };
      }

      const backup = {
        ...options.localBackup,
        exportedAt: new Date().toISOString(),
      };
      await pushBackupToGitHub(config, backup);
      setLastSyncAt(backup.exportedAt);
      return { action: "pushed", localAt: backup.exportedAt, remoteAt: undefined };
    }

    if (!hasLocalData) {
      await options.applyRemote(remote);
      setLastSyncAt(new Date().toISOString());
      return { action: "pulled", localAt, remoteAt: remote.exportedAt };
    }

    if (remoteAt && remoteAt > localAt) {
      await options.applyRemote(remote);
      setLastSyncAt(new Date().toISOString());
      return { action: "pulled", localAt, remoteAt };
    }

    if (!remoteAt || localAt > remoteAt) {
      const backup = {
        ...options.localBackup,
        exportedAt: new Date().toISOString(),
      };
      await pushBackupToGitHub(config, backup, remoteFile?.sha);
      setLastSyncAt(backup.exportedAt);
      return {
        action: "pushed",
        localAt: backup.exportedAt,
        remoteAt: remoteAt ?? undefined,
      };
    }

    setLastSyncAt(new Date().toISOString());
    return { action: "unchanged", localAt, remoteAt: remoteAt ?? undefined };
  } catch (error) {
    if (
      error instanceof Error &&
      (error as Error & { code?: string }).code === "auth-failed"
    ) {
      return { action: "auth-failed", message: error.message };
    }
    return {
      action: "error",
      message: error instanceof Error ? error.message : "GitHub 同步失敗",
    };
  }
}

let githubSyncTimer: ReturnType<typeof setTimeout> | null = null;

export function scheduleGitHubSync(run: () => Promise<GitHubSyncResult>) {
  if (!getGitHubSyncInfo().configured) return;

  if (githubSyncTimer) clearTimeout(githubSyncTimer);
  githubSyncTimer = setTimeout(() => {
    void run().catch(() => {
      // 背景同步失敗不影響正常使用
    });
  }, 2000);
}
