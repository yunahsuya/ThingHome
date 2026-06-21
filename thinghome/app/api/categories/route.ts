import { NextResponse } from "next/server";
import { createCategory, listCategories } from "@/lib/categories";
import type { CategoryInput } from "@/lib/types";

export async function GET() {
  const categories = await listCategories();
  return NextResponse.json({ categories });
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as CategoryInput;

    if (!body.name?.trim()) {
      return NextResponse.json({ error: "分類名稱為必填" }, { status: 400 });
    }

    const category = await createCategory(body);
    return NextResponse.json({ category }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "新增失敗" }, { status: 500 });
  }
}
