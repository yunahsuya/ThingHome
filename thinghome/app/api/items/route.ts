import { NextResponse } from "next/server";
import { createItem, listItems } from "@/lib/db";
import type { ItemInput } from "@/lib/types";

export async function GET() {
  const items = await listItems();
  return NextResponse.json({ items });
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as ItemInput;

    if (!body.name?.trim()) {
      return NextResponse.json({ error: "商品名稱為必填" }, { status: 400 });
    }

    const item = await createItem(body);
    return NextResponse.json({ item }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "新增失敗" }, { status: 500 });
  }
}
