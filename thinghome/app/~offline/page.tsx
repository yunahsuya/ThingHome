export default function OfflinePage() {
  return (
    <div className="mx-auto flex min-h-full max-w-md flex-col items-center justify-center px-6 py-16 text-center">
      <p className="text-sm font-medium" style={{ color: "var(--accent)" }}>ThingHome</p>
      <h1 className="mt-2 text-2xl font-bold tracking-tight">目前離線</h1>
      <p className="mt-3" style={{ color: "var(--muted)" }}>
        無法連線到網路。已快取的頁面仍可瀏覽；新增或更新商品需要恢復連線後再試。
      </p>
    </div>
  );
}
