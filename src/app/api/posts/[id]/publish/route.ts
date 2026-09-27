import { publishPost } from "@/lib/publish";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(_req: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  const postId = Number(id);
  if (!Number.isInteger(postId)) {
    return Response.json({ error: "Invalid id" }, { status: 400 });
  }
  try {
    const { results } = await publishPost(postId);
    return Response.json({ results });
  } catch (e) {
    console.error("Publish failed", e);
    return Response.json({ error: "Publish failed" }, { status: 500 });
  }
}
