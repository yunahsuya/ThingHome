import { promises as fs } from "fs";
import path from "path";
import { NextResponse } from "next/server";
import {
  UPLOAD_DIR,
  getImageContentType,
  sanitizeFilename,
} from "@/lib/storage";

type RouteContext = { params: Promise<{ filename: string }> };

export async function GET(_request: Request, context: RouteContext) {
  const { filename } = await context.params;
  const safe = sanitizeFilename(decodeURIComponent(filename));

  if (!safe) {
    return NextResponse.json({ error: "找不到圖片" }, { status: 404 });
  }

  const filePath = path.join(UPLOAD_DIR, safe);

  try {
    const buffer = await fs.readFile(filePath);
    return new NextResponse(buffer, {
      headers: {
        "Content-Type": getImageContentType(safe),
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  } catch {
    return NextResponse.json({ error: "找不到圖片" }, { status: 404 });
  }
}
