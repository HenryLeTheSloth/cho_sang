import { readFile } from "node:fs/promises";
import { resolveUpload } from "~/lib/uploads.server";
import type { Route } from "./+types/uploads";

export async function loader({ params }: Route.LoaderArgs) {
  const upload = resolveUpload(params["*"]);
  if (!upload) return new Response("Không tìm thấy", { status: 404 });
  try {
    const body = await readFile(upload.file);
    return new Response(body, {
      headers: { "Content-Type": upload.type, "Cache-Control": "public, max-age=604800" },
    });
  } catch {
    return new Response("Không tìm thấy", { status: 404 });
  }
}
