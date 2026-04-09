import { type NextRequest, NextResponse } from "next/server";
import { put } from "@vercel/blob";
import { auth } from "@clerk/nextjs/server";
import { writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const routeDir = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(routeDir, "../../../../");

export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const formData = await req.formData();
  const file = formData.get("file") as File | null;
  const folderInput = formData.get("folder");
  const folder =
    typeof folderInput === "string" && /^[a-z0-9/_-]+$/i.test(folderInput)
      ? folderInput
      : "documents";

  if (!file) {
    return NextResponse.json({ error: "No file provided" }, { status: 400 });
  }

  // Max 10MB
  if (file.size > 10 * 1024 * 1024) {
    return NextResponse.json({ error: "File too large (max 10MB)" }, { status: 400 });
  }

  // Use Vercel Blob in production, local filesystem in dev
  if (process.env.BLOB_READ_WRITE_TOKEN) {
    const blob = await put(`${folder}/${Date.now()}-${file.name}`, file, {
      access: "public",
    });

    return NextResponse.json({
      url: blob.url,
      filename: file.name,
      size: file.size,
      type: file.type,
    });
  }

  // Local dev fallback: save to public/uploads/
  const uploadsDir = path.join(projectRoot, "public", "uploads", folder);
  await mkdir(uploadsDir, { recursive: true });

  const safeName = `${Date.now()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
  const filePath = path.join(uploadsDir, safeName);
  const buffer = Buffer.from(await file.arrayBuffer());
  await writeFile(filePath, buffer);

  return NextResponse.json({
    url: `/uploads/${folder}/${safeName}`,
    filename: file.name,
    size: file.size,
    type: file.type,
  });
}
