import type { ParsedItemDraft } from "@/lib/types";

export interface OcrProgress {
  progress: number;
  status: string;
}

export async function runOcrOnFile(
  file: File,
  onProgress?: (update: OcrProgress) => void,
): Promise<ParsedItemDraft> {
  onProgress?.({ progress: 0, status: "載入 OCR 引擎…" });

  const { createWorker } = await import("tesseract.js");
  const worker = await createWorker("chi_tra+eng", undefined, {
    logger: (m) => {
      if (m.status === "recognizing text" && typeof m.progress === "number") {
        const progress = Math.round(m.progress * 100);
        onProgress?.({ progress, status: `辨識中… ${progress}%` });
      }
    },
  });

  onProgress?.({ progress: 0, status: "正在讀取文字…" });
  const { data } = await worker.recognize(file);
  await worker.terminate();

  const response = await fetch("/api/parse", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text: data.text }),
  });

  if (!response.ok) throw new Error("parse failed");

  const { draft } = (await response.json()) as { draft: ParsedItemDraft };
  return { ...draft, rawText: data.text, confidence: draft.confidence };
}
