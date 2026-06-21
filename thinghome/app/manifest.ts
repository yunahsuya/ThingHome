import type { MetadataRoute } from "next";

export const dynamic = "force-static";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "ThingHome — 居家物品管理",
    short_name: "ThingHome",
    description: "拍照 OCR 辨識、記錄購買日期、期限、剩餘數量與價格",
    start_url: "/ThingHome/",
    display: "standalone",
    background_color: "#f0e4d6",
    theme_color: "#c9956a",
    orientation: "portrait",
    lang: "zh-Hant",
    icons: [
      {
        src: "/icons/icon-192x192.png",
        sizes: "192x192",
        type: "image/png",
      },
      {
        src: "/icons/icon-512x512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/icon-512x512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
