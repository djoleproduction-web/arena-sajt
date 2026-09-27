import { put } from "@vercel/blob";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const form = await req.formData();
  const file = form.get("file");

  if (!(file instanceof File)) {
    return Response.json({ error: "No file provided" }, { status: 400 });
  }

  const okType =
    file.type === "video/mp4" ||
    file.type === "video/quicktime" ||
    /\.(mp4|mov)$/i.test(file.name);
  if (!okType) {
    return Response.json({ error: "Only MP4 or MOV files are supported" }, { status: 400 });
  }

  const MAX_BYTES = 500 * 1024 * 1024;
  if (file.size > MAX_BYTES) {
    return Response.json({ error: "File is too large (max 500MB)" }, { status: 400 });
  }

  try {
    const blob = await put(`videos/${Date.now()}-${file.name}`, file, {
      access: "public",
      contentType: file.type || "video/mp4",
    });

    return Response.json({ url: blob.url });
  } catch (e) {
    console.error("Upload failed", e);
    return Response.json({ error: "Upload failed" }, { status: 500 });
  }
}
