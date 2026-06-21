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
  location: string | null;
  purchaseDate: string | null;
  expiryDate: string | null;
  shelfLifeDays: number | null;
  quantity: number;
  remaining: number;
  price: number | null;
  unit: string | null;
  notes: string | null;
  imagePaths: string[];
  source: ItemSource;
  batchId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ItemInput {
  name: string;
  categoryId?: string | null;
  location?: string | null;
  purchaseDate?: string | null;
  expiryDate?: string | null;
  shelfLifeDays?: number | null;
  quantity?: number | null;
  remaining?: number | null;
  price?: number | null;
  unit?: string | null;
  notes?: string | null;
  imagePaths?: string[];
  source?: ItemSource;
  batchId?: string | null;
}

export interface ItemSubmitOptions {
  addedImageFiles?: File[];
  removedImagePaths?: string[];
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
