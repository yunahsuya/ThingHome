import { NextResponse } from "next/server";
import { deleteCategory, getCategory, updateCategory } from "@/lib/categories";
import type { CategoryInput } from "@/lib/types";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: Request, context: RouteContext) {
  const { id } = await context.params;
  const category = await getCategory(id);

  if (!category) {
    return NextResponse.json({ error: "找不到分類" }, { status: 404 });
  }

  return NextResponse.json({ category });
}

export async function PUT(request: Request, context: RouteContext) {
  const { id } = await context.params;

  try {
    const body = (await request.json()) as Partial<CategoryInput>;

    if (body.name !== undefined && !body.name.trim()) {
      return NextResponse.json({ error: "分類名稱不可為空" }, { status: 400 });
    }

    const category = await updateCategory(id, body);

    if (!category) {
      return NextResponse.json({ error: "找不到分類" }, { status: 404 });
    }

    return NextResponse.json({ category });
  } catch {
    return NextResponse.json({ error: "更新失敗" }, { status: 500 });
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  const { id } = await context.params;
  const ok = await deleteCategory(id);

  if (!ok) {
    return NextResponse.json({ error: "找不到分類" }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}
