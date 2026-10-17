import sharp from "sharp";
import { afterAll, expect, test } from "vitest";
import { db } from "~/lib/db.server";
import { loader } from "~/routes/gift-preview";

afterAll(() => db.$disconnect());

const get = (id: string) => loader({ params: { id } } as Parameters<typeof loader>[0]);

test("/gift/preview/:id trả đúng byte ảnh (cache lâu, chỉ trình duyệt này, nosniff); id lạ, sai dạng hoặc dữ liệu hỏng thì 404", async () => {
  const webp = (await sharp({ create: { width: 8, height: 8, channels: 3, background: "#fff" } }).webp().toBuffer()).toString("base64");
  const base = await db.product.findFirstOrThrow({ where: { isGiftBase: true } });
  const [good, bad] = await Promise.all([
    db.giftBundle.create({ data: { baseProductId: base.id, layout: [], preview: `data:image/webp;base64,${webp}` } }),
    db.giftBundle.create({ data: { baseProductId: base.id, layout: [], preview: "data:text/html;base64,PGgxPg==" } }),
  ]);
  try {
    const image = await get(good.id);
    expect(image.status).toBe(200);
    expect(image.headers.get("Content-Type")).toBe("image/webp");
    expect(image.headers.get("Cache-Control")).toBe("private, max-age=31536000, immutable");
    expect(image.headers.get("X-Content-Type-Options")).toBe("nosniff");
    expect(Buffer.from(await image.arrayBuffer()).toString("base64")).toBe(webp);
    for (const id of [bad.id, "cmgr0x9k10000abcd1234efgh", "../../.env"]) expect((await get(id)).status).toBe(404);
  } finally {
    await db.giftBundle.deleteMany({ where: { id: { in: [good.id, bad.id] } } });
  }
});
