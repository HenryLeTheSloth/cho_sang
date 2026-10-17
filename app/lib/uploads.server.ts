import path from "node:path";
import { env } from "./env.server";

// Chỉ đúng dạng file saveSquareImage (-320/-640/-1080) và saveCutoutImage (-cutout, M4) ghi ra;
// không có "." hay "/" thừa nên không thể thoát khỏi UPLOAD_DIR
const FILE = /^products\/[a-z0-9]+(?:-[a-z0-9]+)*-(?:320|640|1080|cutout)\.(avif|webp)$/;

export function resolveUpload(splat: string | undefined) {
  const match = splat?.match(FILE);
  if (!splat || !match) return null;
  return { file: path.join(env.UPLOAD_DIR, splat), type: `image/${match[1]}` };
}
