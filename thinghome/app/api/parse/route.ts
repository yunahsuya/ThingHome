import { NextResponse } from "next/server";
import { parseProductText } from "@/lib/parse-text";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { text?: string };

    if (!body.text?.trim()) {
      return NextResponse.json({ error: "請提供文字內容" }, { status: 400 });
    }

    const draft = parseProductText(body.text);
    return NextResponse.json({ draft });
  } catch {
    return NextResponse.json({ error: "解析失敗" }, { status: 500 });
  }
}
