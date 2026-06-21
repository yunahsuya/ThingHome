import { NextResponse } from "next/server";
import { deleteItem, getItem, updateItem } from "@/lib/db";
import type { ItemInput } from "@/lib/types";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: Request, context: RouteContext) {
  const { id } = await context.params;
  const item = await getItem(id);

  if (!item) {
    return NextResponse.json({ error: "找不到商品" }, { status: 404 });
  }

  return NextResponse.json({ item });
}

export async function PUT(request: Request, context: RouteContext) {
  const { id } = await context.params;

  try {
    const body = (await request.json()) as Partial<ItemInput>;

    if (body.name !== undefined && !body.name.trim()) {
      return NextResponse.json({ error: "商品名稱不可為空" }, { status: 400 });
    }

    const item = await updateItem(id, body);

    if (!item) {
      return NextResponse.json({ error: "找不到商品" }, { status: 404 });
    }

    return NextResponse.json({ item });
  } catch {
    return NextResponse.json({ error: "更新失敗" }, { status: 500 });
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  const { id } = await context.params;
  const ok = await deleteItem(id);

  if (!ok) {
    return NextResponse.json({ error: "找不到商品" }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}
