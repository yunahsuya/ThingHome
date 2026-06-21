import type { ParsedItemDraft } from "./types";

function normalizeDate(y: number, m: number, d: number): string | null {
  if (m < 1 || m > 12 || d < 1 || d > 31) return null;
  const iso = `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) return null;
  return iso;
}

function extractDates(text: string): string[] {
  const dates: string[] = [];

  const western = text.matchAll(
    /(?:20\d{2}|19\d{2})[\/\-.年](\d{1,2})[\/\-.月](\d{1,2})日?/g,
  );
  for (const match of text.matchAll(
    /(20\d{2}|19\d{2})[\/\-.](\d{1,2})[\/\-.](\d{1,2})/g,
  )) {
    const iso = normalizeDate(Number(match[1]), Number(match[2]), Number(match[3]));
    if (iso) dates.push(iso);
  }
  for (const match of western) {
    const yearMatch = match[0].match(/(20\d{2}|19\d{2})/);
    if (!yearMatch) continue;
    const iso = normalizeDate(
      Number(yearMatch[1]),
      Number(match[1]),
      Number(match[2]),
    );
    if (iso) dates.push(iso);
  }

  for (const match of text.matchAll(
    /(?:民國|ROC)?\s*(\d{2,3})[\/\-.](\d{1,2})[\/\-.](\d{1,2})/g,
  )) {
    const iso = normalizeDate(
      Number(match[1]) + 1911,
      Number(match[2]),
      Number(match[3]),
    );
    if (iso) dates.push(iso);
  }

  return [...new Set(dates)];
}

function extractPrice(text: string): number | null {
  const patterns = [
    /(?:NT\$|NT\s?\$|新台幣|總(?:計|金額)?|合計|金額)[:：\s]*\$?\s*([\d,]+(?:\.\d{1,2})?)/i,
    /\$\s*([\d,]+(?:\.\d{1,2})?)/,
    /([\d,]+(?:\.\d{1,2})?)\s*元/,
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) {
      const value = Number(match[1].replace(/,/g, ""));
      if (!Number.isNaN(value) && value > 0) return value;
    }
  }

  const numbers = [...text.matchAll(/\b(\d{2,5})\b/g)]
    .map((m) => Number(m[1]))
    .filter((n) => n >= 10 && n <= 99999);
  return numbers.length > 0 ? numbers[numbers.length - 1] : null;
}

function extractShelfLifeDays(text: string): number | null {
  const match = text.match(
    /(?:保存|有效|賞味|使用)(?:期限|天數)?[:：\s]*(\d{1,4})\s*天/,
  );
  if (match) return Number(match[1]);

  const generic = text.match(/(\d{1,4})\s*天(?:內|以內)?(?:有效|保存|食用)?/);
  return generic ? Number(generic[1]) : null;
}

function extractExpiryDate(text: string, dates: string[]): string | null {
  const expiryLine = text.match(
    /(?:有效|保存|賞味|使用)期限[:：\s]*(\d{4}[\/\-.]\d{1,2}[\/\-.]\d{1,2}|\d{2,3}[\/\-.]\d{1,2}[\/\-.]\d{1,2})/,
  );
  if (expiryLine) {
    const extra = extractDates(expiryLine[0]);
    if (extra.length > 0) return extra[extra.length - 1];
  }

  if (dates.length >= 2) return dates[dates.length - 1];
  return null;
}

function extractQuantity(text: string): { quantity: number | null; unit: string | null } {
  const unitMatch = text.match(
    /(?:數量|x|×)[:：\s]*(\d+)\s*(包|瓶|盒|個|入|罐|袋|片|條|組)?/i,
  );
  if (unitMatch) {
    return {
      quantity: Number(unitMatch[1]),
      unit: unitMatch[2] ?? null,
    };
  }

  const trailing = text.match(/(\d+)\s*(包|瓶|盒|個|入|罐|袋)/);
  if (trailing) {
    return { quantity: Number(trailing[1]), unit: trailing[2] };
  }

  return { quantity: 1, unit: null };
}

function extractName(text: string): string | null {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  const skip = /^(總計|合計|小計|日期|時間|收銀|發票|電子|統編|店名|電話|地址|NT\$|\$|\d+$)/i;

  const candidates = lines.filter(
    (line) =>
      line.length >= 2 &&
      line.length <= 40 &&
      !skip.test(line) &&
      !/^\d+[\/\-.]\d+[\/\-.]\d+$/.test(line) &&
      !/^[\d\s$元.,]+$/.test(line),
  );

  if (candidates.length === 0) return lines[0]?.slice(0, 40) ?? null;

  return candidates.sort((a, b) => b.length - a.length)[0] ?? null;
}

/** 從收據文字推測有幾項商品（用於決定新增表單數量） */
export function countDetectedProducts(rawText: string): number {
  const text = rawText.trim();
  if (!text) return 1;

  const itemCountMatch = text.match(/(\d+)\s*個?\s*品\s*項/);
  if (itemCountMatch) {
    const count = Number(itemCountMatch[1]);
    if (count >= 2 && count <= 20) return count;
  }

  const skip =
    /(?:總計|合計|小計|節省|營業稅|稅|免費|確認|discount|-\$)/i;
  const priceLines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(
      (line) =>
        line.length > 0 &&
        /\$\s*[\d,]+(?:\.\d{1,2})?/.test(line) &&
        !skip.test(line),
    );

  if (priceLines.length >= 2) return Math.min(priceLines.length, 20);

  return 1;
}

export function parseProductText(rawText: string): ParsedItemDraft {
  const text = rawText.trim();
  const dates = extractDates(text);
  const price = extractPrice(text);
  const shelfLifeDays = extractShelfLifeDays(text);
  const expiryDate = extractExpiryDate(text, dates);
  const { quantity, unit } = extractQuantity(text);
  const name = extractName(text);

  const purchaseDate =
    dates.length > 0 && expiryDate && dates[0] !== expiryDate
      ? dates[0]
      : dates.length === 1 && !expiryDate
        ? dates[0]
        : dates.length > 0
          ? dates[0]
          : null;

  let confidence: ParsedItemDraft["confidence"] = "low";
  if (name && (price !== null || purchaseDate || expiryDate)) {
    confidence = "high";
  } else if (name || price !== null || purchaseDate) {
    confidence = "medium";
  }

  return {
    name,
    purchaseDate,
    expiryDate,
    shelfLifeDays,
    quantity,
    remaining: quantity,
    price,
    unit,
    notes: text.length > 0 ? text.slice(0, 500) : null,
    rawText: text,
    confidence,
  };
}

export function getDaysRemaining(item: {
  expiryDate: string | null;
  purchaseDate: string | null;
  shelfLifeDays: number | null;
}): number | null {
  if (item.expiryDate) {
    const diff = Math.ceil(
      (new Date(item.expiryDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24),
    );
    return diff;
  }

  if (item.purchaseDate && item.shelfLifeDays) {
    const expiry = new Date(item.purchaseDate);
    expiry.setDate(expiry.getDate() + item.shelfLifeDays);
    return Math.ceil((expiry.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
  }

  return null;
}
