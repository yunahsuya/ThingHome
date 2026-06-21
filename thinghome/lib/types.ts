export type ItemSource = "manual" | "text" | "ocr";

export interface Category {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
}

export interface CategoryInput {
  name: string;
}

export interface Item {
  id: string;
  name: string;
  categoryId: string | null;
  purchaseDate: string | null;
  expiryDate: string | null;
  shelfLifeDays: number | null;
  quantity: number;
  remaining: number;
  price: number | null;
  unit: string | null;
  notes: string | null;
  imagePath: string | null;
  source: ItemSource;
  createdAt: string;
  updatedAt: string;
}

export interface ItemInput {
  name: string;
  categoryId?: string | null;
  purchaseDate?: string | null;
  expiryDate?: string | null;
  shelfLifeDays?: number | null;
  quantity?: number;
  remaining?: number;
  price?: number | null;
  unit?: string | null;
  notes?: string | null;
  imagePath?: string | null;
  source?: ItemSource;
}

export interface ItemSubmitOptions {
  imageFile?: File | null;
  removeImage?: boolean;
}

export interface ParsedItemDraft {
  name: string | null;
  purchaseDate: string | null;
  expiryDate: string | null;
  shelfLifeDays: number | null;
  quantity: number | null;
  remaining: number | null;
  price: number | null;
  unit: string | null;
  notes: string | null;
  rawText: string;
  confidence: "high" | "medium" | "low";
}
