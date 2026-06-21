import { NextResponse } from "next/server";
import { saveImage } from "@/lib/storage";

export async function POST(request: Request) {
  try {
    const form = await request.formData();
    const file = form.get("file");

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "請上傳圖片" }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const imagePath = await saveImage(buffer, file.name);

    return NextResponse.json({ imagePath }, { status: 201 });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "照片上傳失敗";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
