import { expect, type Page, test } from "@playwright/test";
import sharp from "sharp";
import { addToCart, fillCheckout, product, sql, waitForHydration } from "./helpers";

/** Trang /gift đã hydrate và Fabric đã tải xong (ô chọn món chỉ bật khi canvas sẵn sàng). */
async function openGift(page: Page) {
  await page.goto("/gift");
  await waitForHydration(page);
  await expect(page.getByRole("button", { name: "Thêm Cam sành vào giỏ quà" })).toBeEnabled();
}

/**
 * Làm chậm POST /cart.data `ms` (GET đi ngay), để lệnh trước còn bay (formData của fetcher còn đó) khi bấm lệnh sau.
 * - "after": route.fetch() gửi ngay; server xử lý và Set-Cookie vào context NGAY khi route.fetch trả về, kể cả khi trang
 *   huỷ request sau đó. Độ trễ chỉ giữ phản hồi lại, tức giữ formData của fetcher đang bay.
 * - "before": chờ rồi mới gửi tiếp; lệnh bị lệnh sau huỷ trong lúc chờ không bao giờ tới server (mạng chậm chiều đi).
 */
async function slowCartPosts(page: Page, when: "before" | "after", ms = 800) {
  await page.route("**/cart.data*", async (route) => {
    if (route.request().method() !== "POST") return route.continue().catch(() => {});
    if (when === "before") {
      await new Promise((r) => setTimeout(r, ms));
      return route.continue().catch(() => {}); // trang đã huỷ request: không tới server
    }
    const response = await route.fetch().catch(() => null);
    await new Promise((r) => setTimeout(r, ms));
    if (response) await route.fulfill({ response }).catch(() => {});
    else await route.abort().catch(() => {});
  });
}

/** Chờ phản hồi của đúng lệnh POST /cart.data có form thoả `has` (lệnh cuối mang toàn bộ trạng thái đang chờ). */
const cartPosted = (page: Page, has: (form: URLSearchParams) => boolean) =>
  page.waitForResponse(
    (r) => r.request().method() === "POST" && new URL(r.url()).pathname === "/cart.data" && has(new URLSearchParams(r.request().postData() ?? "")),
  );

const serverCart = (page: Page) =>
  page.evaluate(async () => (await (await fetch("/cart")).json()) as { bundles: { id: string; itemCount: number }[]; lines: { slug: string; qty: number }[] });

/** Bấm "Thêm vào giỏ hàng", trả form đã gửi lên /gift (layout, message, preview). */
async function submitGift(page: Page) {
  const request = page.waitForRequest((r) => r.method() === "POST" && new URL(r.url()).pathname.startsWith("/gift"));
  await page.getByRole("button", { name: /^Thêm vào giỏ hàng/ }).click();
  return new URLSearchParams((await request).postData() ?? "");
}

test("DoD M4: xếp 10 món + lời chúc → giỏ hàng → COD → đơn hiện ảnh giỏ quà và đúng tổng tiền", async ({ page }) => {
  const picks = { "Cam sành": 4, "Chuối già Nam Mỹ": 3, "Xoài cát Hòa Lộc": 3 }; // 4×39 + 3×32 + 3×85 = 507 nghìn
  const problems: string[] = []; // lỗi console / hydrate trên /gift, checkout và trang đơn có giỏ quà
  page.on("console", (m) => {
    if (m.type() === "error" || m.type() === "warning") problems.push(m.text());
  });
  page.on("pageerror", (e) => problems.push(String(e)));
  const before = await Promise.all(["cam-sanh", "chuoi-gia", "xoai-cat-hoa-loc", "gio-may-qua-bieu"].map(async (s) => (await product(s)).stock));
  await openGift(page);
  for (const [name, n] of Object.entries(picks)) {
    for (let i = 0; i < n; i++) await page.getByRole("button", { name: `Thêm ${name} vào giỏ quà` }).click();
  }
  await expect(page.getByText("10/10 món")).toBeVisible();
  await expect(page.getByRole("button", { name: "Thêm Cam sành vào giỏ quà" })).toBeDisabled(); // tối đa 10 món
  await expect(page.getByRole("button", { name: /^Bỏ .+ khỏi giỏ quà$/ })).toHaveCount(10); // danh sách ngoài canvas
  await page.getByLabel("Lời chúc").fill("Chúc mừng năm mới, an khang thịnh vượng!");
  await expect(page.getByRole("button", { name: "Thêm vào giỏ hàng · 627.000₫" })).toBeEnabled(); // vỏ giỏ 120.000₫ + 507.000₫

  const sent = await submitGift(page);
  expect(JSON.parse(sent.get("layout")!)).toHaveLength(10);
  expect(sent.get("preview")!.length).toBeLessThanOrEqual(60 * 1024);
  expect(sent.get("preview")).toMatch(/^data:image\/(webp|jpeg);base64,/);

  // Drawer tự mở: một dòng "Giỏ quà · 10 món" có ảnh (img thường, không Fabric)
  const drawer = page.locator("#cart-drawer");
  await expect(drawer.getByText("Giỏ quà · 10 món")).toBeVisible();
  await expect(drawer.locator('img[src^="/gift/preview/"]')).toHaveJSProperty("complete", true);
  expect(await drawer.locator('img[src^="/gift/preview/"]').evaluate((img: HTMLImageElement) => img.naturalWidth)).toBeGreaterThan(0);
  await expect(page.locator("#cart-button")).toHaveAccessibleName("Giỏ hàng, 1 món");
  await drawer.getByRole("link", { name: "Thanh toán · 627.000₫" }).click();

  await expect(page).toHaveURL(/\/checkout$/);
  await waitForHydration(page);
  await expect(page.getByRole("complementary").getByText("Giỏ quà · 10 món")).toBeVisible(); // tóm tắt checkout có dòng giỏ quà
  await fillCheckout(page, "0911000041");
  await page.getByRole("button", { name: "Đặt hàng · 627.000₫" }).click();

  await expect(page).toHaveURL(/\/orders\/DH\d{6}[A-Z0-9]{4}$/);
  await expect(page.getByRole("heading", { name: "Giỏ quà · 10 món" })).toBeVisible();
  await expect(page.getByText("Lời chúc: “Chúc mừng năm mới, an khang thịnh vượng!”")).toBeVisible();
  const preview = page.getByRole("img", { name: "Ảnh giỏ quà 10 món" });
  expect(await preview.evaluate((img: HTMLImageElement) => img.naturalWidth)).toBeGreaterThan(0);
  await expect(page.getByRole("list", { name: "Trong giỏ quà 10 món" }).getByText("Cam sành × 4")).toBeVisible();
  const totalRow = page.locator("dl > div").filter({ has: page.locator("dt", { hasText: /^Tổng$/ }) });
  await expect(totalRow.locator("dd")).toHaveText("627.000₫"); // tổng đơn = tổng khách đã thấy
  const code = page.url().split("/").at(-1)!;
  const [{ total }] = await sql<{ total: number }>('SELECT "totalVnd" AS total FROM "Order" WHERE code = $1', [code]);
  expect(total).toBe(627000);
  const after = await Promise.all(["cam-sanh", "chuoi-gia", "xoai-cat-hoa-loc", "gio-may-qua-bieu"].map(async (s) => (await product(s)).stock));
  expect(after).toEqual([before[0] - 4, before[1] - 3, before[2] - 3, before[3] - 1]); // trừ kho từng món + vỏ giỏ
  await expect(page.locator("#cart-button")).toHaveAccessibleName("Giỏ hàng, 0 món");
  expect(problems).toEqual([]);
});

test("375px cảm ứng: kéo một món trên canvas bằng ngón tay thì toạ độ gửi lên đổi theo", async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 375, height: 812 }, hasTouch: true, isMobile: true });
  const page = await context.newPage();
  await openGift(page);
  await page.getByRole("button", { name: "Thêm Cam sành vào giỏ quà" }).tap();
  const box = (await page.locator("main canvas").last().boundingBox())!; // canvas trên cùng của Fabric (nhận sự kiện)
  const scale = box.width / 400;
  const from = { x: box.x + 200 * scale, y: box.y + 224 * scale }; // vị trí món đầu tiên (gift-canvas.client.ts: 0.5, 0.56)
  const cdp = await context.newCDPSession(page);
  const touch = (type: "touchStart" | "touchMove" | "touchEnd", x: number, y: number) =>
    cdp.send("Input.dispatchTouchEvent", { type, touchPoints: type === "touchEnd" ? [] : [{ x, y }] });
  await touch("touchStart", from.x, from.y);
  for (let i = 1; i <= 10; i++) await touch("touchMove", from.x + 12 * i * scale, from.y - 5 * i * scale);
  await touch("touchEnd", 0, 0);
  const [item] = JSON.parse((await submitGift(page)).get("layout")!);
  expect(item.x).toBeCloseTo((200 + 120) / 400, 1); // kéo sang phải 120 đơn vị logic
  expect(item.y).toBeCloseTo((224 - 50) / 400, 1);
  await context.close();
});

test("DoD M4: layout gửi thẳng lên với pid lạ hoặc quá 10 món bị từ chối, không tạo giỏ quà", async ({ page }) => {
  const preview = `data:image/webp;base64,${(await sharp({ create: { width: 8, height: 8, channels: 3, background: "#fff" } }).webp().toBuffer()).toString("base64")}`;
  const cam = (await product("cam-sanh")).id;
  const at = { x: 0.5, y: 0.5, s: 1, r: 0 };
  const [{ n: before }] = await sql<{ n: string }>('SELECT count(*) AS n FROM "GiftBundle"');
  for (const layout of [[{ pid: 999999, ...at }], Array.from({ length: 11 }, () => ({ pid: cam, ...at }))]) {
    const res = await page.request.post("/gift", { form: { layout: JSON.stringify(layout), message: "", preview } });
    expect(res.status()).toBe(400);
  }
  const [{ n: after }] = await sql<{ n: string }>('SELECT count(*) AS n FROM "GiftBundle"');
  expect(after).toBe(before);
});

test("Fabric không có ở trang chủ và các trang khác; chỉ /gift tải nó", async ({ page }) => {
  const scripts: string[] = [];
  page.on("request", (r) => {
    if (r.resourceType() === "script") scripts.push(new URL(r.url()).pathname);
  });
  for (const path of ["/", "/collections/all", "/products/xoai-cat-hoa-loc"]) {
    await page.goto(path);
    await waitForHydration(page);
  }
  expect(scripts.filter((s) => s.includes("gift-canvas"))).toEqual([]);
  await page.getByRole("link", { name: "Chợ Sáng" }).click(); // về trang chủ bằng điều hướng client
  await page.getByRole("link", { name: /Tự xếp giỏ quà biếu/ }).click(); // đường vào /gift ở trang chủ
  await expect(page.getByRole("button", { name: "Thêm Cam sành vào giỏ quà" })).toBeEnabled();
  expect(scripts.filter((s) => s.includes("gift-canvas"))).toHaveLength(1);
});

test("drawer: xoá giỏ quà có Hoàn tác; Hoàn tác trả lại đúng giỏ quà", async ({ page }) => {
  await openGift(page);
  await page.getByRole("button", { name: "Thêm Xoài cát Hòa Lộc vào giỏ quà" }).click();
  await submitGift(page);
  const drawer = page.locator("#cart-drawer");
  await expect(drawer.getByText("Giỏ quà · 1 món")).toBeVisible();
  await drawer.getByRole("button", { name: "Xoá giỏ quà 1 món khỏi giỏ" }).click();
  await expect(drawer.getByText("Đã xoá giỏ quà 1 món")).toBeVisible();
  await expect(drawer.getByText("Giỏ quà · 1 món")).toHaveCount(0);
  await drawer.getByRole("button", { name: "Hoàn tác" }).click();
  await expect(drawer.getByText("Giỏ quà · 1 món")).toBeVisible();
  await expect(page.locator("#cart-button")).toHaveAccessibleName("Giỏ hàng, 1 món");
});

test("Hoàn tác xoá giỏ quà khi lệnh xoá đã về nhưng trang còn đang tải lại (mạng chậm): giỏ quà quay lại", async ({ page }) => {
  await openGift(page);
  await page.getByRole("button", { name: "Thêm Xoài cát Hòa Lộc vào giỏ quà" }).click();
  await submitGift(page);
  const drawer = page.locator("#cart-drawer");
  await expect(drawer.getByText("Giỏ quà · 1 món")).toBeVisible();
  // Chỉ làm chậm lượt tải lại (GET *.data) như 4G chậm; POST /cart.data đi ngay
  await page.route("**/*.data*", async (route) => {
    if (route.request().method() === "GET") await new Promise((r) => setTimeout(r, 1500));
    await route.continue().catch(() => {});
  });
  const removed = page.waitForResponse((r) => r.request().method() === "POST" && new URL(r.url()).pathname === "/cart.data");
  await drawer.getByRole("button", { name: "Xoá giỏ quà 1 món khỏi giỏ" }).click();
  await removed; // cookie đã mất id giỏ quà; fetcher còn ở "loading" với formData cũ
  await drawer.getByRole("button", { name: "Hoàn tác" }).click();
  await expect.poll(async () => (await serverCart(page)).bundles.length).toBe(1); // trước Hoàn tác là 0: chờ tới khi quay lại
  await expect(page.locator("#cart-button")).toHaveAccessibleName("Giỏ hàng, 1 món");
  await page.unrouteAll({ behavior: "ignoreErrors" });
});

test("chạm đúp 'Thêm vào giỏ hàng' trên mạng chậm: giỏ hàng chỉ có 1 giỏ quà", async ({ page }) => {
  await page.route("**/gift.data*", async (route) => {
    await new Promise((r) => setTimeout(r, 600));
    await route.continue();
  });
  await openGift(page);
  let posts = 0;
  page.on("request", (r) => {
    if (r.method() === "POST" && new URL(r.url()).pathname.startsWith("/gift")) posts++;
  });
  const [{ n: before }] = await sql<{ n: string }>('SELECT count(*) AS n FROM "GiftBundle"');
  await page.getByRole("button", { name: "Thêm Cam sành vào giỏ quà" }).click();
  await expect(page.getByRole("button", { name: /^Thêm vào giỏ hàng/ })).toBeEnabled(); // ảnh món đã lên canvas
  await page.evaluate(() => {
    const button = [...document.querySelectorAll("button")].find((b) => b.textContent?.startsWith("Thêm vào giỏ hàng"))!;
    button.click(); // hai lần chạm sát nhau, không chờ React vẽ lại
    button.click();
  });
  await expect(page.locator("#cart-drawer").getByText("Giỏ quà · 1 món")).toBeVisible();
  const cart = await page.evaluate(async () => (await (await fetch("/cart")).json()) as { bundles: unknown[] });
  expect(cart.bundles).toHaveLength(1);
  expect(posts).toBe(1); // nút khoá ngay lần chạm đầu: không có GiftBundle mồ côi
  const [{ n: after }] = await sql<{ n: string }>('SELECT count(*) AS n FROM "GiftBundle"');
  expect(Number(after) - Number(before)).toBe(1);
});

test("xoá giỏ quà rồi bấm + ngay (response về trễ, lệch thứ tự): giỏ quà không sống lại, số lượng đúng", async ({ page }) => {
  await openGift(page);
  await page.getByRole("button", { name: "Thêm Cam sành vào giỏ quà" }).click();
  await submitGift(page);
  await expect(page.locator("#cart-drawer").getByText("Giỏ quà · 1 món")).toBeVisible();
  await addToCart(page, "rau-muong");
  await page.goto("/collections/all");
  await waitForHydration(page);
  let n = 0;
  let lateDone!: () => void;
  const late = new Promise<void>((r) => (lateDone = r));
  await page.route("**/cart.data*", async (route) => {
    const first = n++ === 0;
    const response = await route.fetch().catch(() => null);
    await new Promise((r) => setTimeout(r, first ? 800 : 100)); // lệnh xoá giỏ quà về sau cùng
    if (response) await route.fulfill({ response }).catch(() => {});
    else await route.abort().catch(() => {});
    if (first) lateDone();
  });
  await page.locator("#cart-button").click();
  await page.evaluate(() => {
    const $ = (s: string) => document.querySelector<HTMLElement>(s)!;
    $('[aria-label="Xoá giỏ quà 1 món khỏi giỏ"]').click(); // không chờ giữa hai lần bấm
    $('[aria-label="Thêm 1 Rau muống"]').click();
  });
  await late; // phản hồi trễ (lệch thứ tự) đã về: từ đây giỏ quà không được sống lại
  await expect
    .poll(async () => {
      const cart = await serverCart(page);
      return { bundles: cart.bundles.length, lines: cart.lines.map((l) => [l.slug, l.qty]) };
    })
    .toEqual({ bundles: 0, lines: [["rau-muong", 2]] });
  await expect(page.locator("#cart-button")).toHaveAccessibleName("Giỏ hàng, 2 món");
});

test("trình duyệt không mã hoá được webp (Safari): ảnh xem trước gửi jpeg và vẫn vào giỏ", async ({ page }) => {
  await page.addInitScript(() => {
    const original = HTMLCanvasElement.prototype.toDataURL;
    HTMLCanvasElement.prototype.toDataURL = function (type?: string, quality?: number) {
      return original.call(this, type === "image/webp" ? "image/png" : type, quality); // như Safari: webp → PNG
    };
  });
  await openGift(page);
  await page.getByRole("button", { name: "Thêm Bơ 034 vào giỏ quà" }).click();
  const sent = await submitGift(page);
  expect(sent.get("preview")).toMatch(/^data:image\/jpeg;base64,/);
  await expect(page.locator("#cart-drawer").getByText("Giỏ quà · 1 món")).toBeVisible();
});

test("xoá giỏ quà, bấm + món khác, rồi Hoàn tác: giỏ quà quay lại, số lượng đúng", async ({ page }) => {
  await openGift(page);
  await page.getByRole("button", { name: "Thêm Cam sành vào giỏ quà" }).click();
  await submitGift(page);
  const drawer = page.locator("#cart-drawer");
  await expect(drawer.getByText("Giỏ quà · 1 món")).toBeVisible();
  await addToCart(page, "rau-muong");
  await page.goto("/collections/all");
  await waitForHydration(page);
  await slowCartPosts(page, "after"); // cookie vào context ngay khi server xử lý: lệnh xoá có thể đã tới cookie trước Hoàn tác
  await page.locator("#cart-button").click();
  await drawer.getByRole("button", { name: "Xoá giỏ quà 1 món khỏi giỏ" }).click();
  await drawer.getByRole("button", { name: "Thêm 1 Rau muống" }).click(); // lệnh xoá giỏ quà còn bay
  const undo = page.waitForRequest((r) => r.method() === "POST" && new URL(r.url()).pathname === "/cart.data");
  await drawer.getByRole("button", { name: "Hoàn tác" }).click(); // lệnh + còn bay
  await (await undo).response(); // lệnh cuối (mang toàn bộ trạng thái đang chờ) đã về
  await expect
    .poll(async () => {
      const cart = await serverCart(page);
      return { bundles: cart.bundles.length, lines: cart.lines.map((l) => [l.slug, l.qty]) };
    })
    .toEqual({ bundles: 1, lines: [["rau-muong", 2]] });
  await expect(page.locator("#cart-button")).toHaveAccessibleName("Giỏ hàng, 3 món");
});

test("Hoàn tác giỏ A rồi xoá giỏ B ngay (lệnh Hoàn tác còn bay): A còn, B mất", async ({ page }) => {
  await openGift(page);
  const drawer = page.locator("#cart-drawer");
  await page.getByRole("button", { name: "Thêm Cam sành vào giỏ quà" }).click();
  await submitGift(page);
  await expect(drawer.getByText("Giỏ quà · 1 món")).toBeVisible();
  await drawer.getByRole("button", { name: "Đóng giỏ hàng" }).click();
  await page.getByRole("button", { name: "Thêm Chuối già Nam Mỹ vào giỏ quà" }).click();
  await page.getByRole("button", { name: "Thêm Bơ 034 vào giỏ quà" }).click();
  await submitGift(page);
  await expect(drawer.getByText("Giỏ quà · 2 món")).toBeVisible();
  const { bundles } = await serverCart(page);
  const a = bundles.find((b) => b.itemCount === 1)!.id;
  const b = bundles.find((b) => b.itemCount === 2)!.id;
  await slowCartPosts(page, "before"); // lệnh Hoàn tác bị huỷ khi còn chờ thì không bao giờ tới server
  const removedA = cartPosted(page, (f) => f.getAll("bundleRemove").includes(a));
  await drawer.getByRole("button", { name: "Xoá giỏ quà 1 món khỏi giỏ" }).click();
  await removedA; // cookie đã mất A: Hoàn tác phải thêm lại A, không chỉ bỏ A khỏi danh sách đang chờ
  const removedB = cartPosted(page, (f) => f.getAll("bundleRemove").includes(b));
  await drawer.getByRole("button", { name: "Hoàn tác" }).click();
  await drawer.getByRole("button", { name: "Xoá giỏ quà 2 món khỏi giỏ" }).click(); // lệnh Hoàn tác còn bay, bị lệnh này huỷ
  await removedB;
  await expect.poll(async () => (await serverCart(page)).bundles.map((x) => x.id)).toEqual([a]);
  await expect(page.locator("#cart-button")).toHaveAccessibleName("Giỏ hàng, 1 món");
});

// Chuỗi nguyên văn của cổng UI M4 (thật ra 125 ký tự): ô lời chúc giữ 120 ký tự đầu, tới "…hạnh p"
const MSG120 = "Kính chúc ông bà năm mới an khang thịnh vượng, vạn sự như ý, sức khoẻ dồi dào, tiền vô như nước, con cháu đề huề, hạnh phúc!!";

/** Hàng (toạ độ logic 0–400) đầu tiên có màu mực của lời chúc (#2A1B3D) trong ảnh xem trước. */
async function firstInkRow(preview: string) {
  const { data, info } = await sharp(Buffer.from(preview.split(",")[1], "base64")).raw().toBuffer({ resolveWithObject: true });
  for (let y = 0; y < info.height; y++) {
    for (let x = 0; x < info.width; x++) {
      const i = (y * info.width + x) * info.channels;
      if (data[i] < 110 && data[i + 1] < 90 && data[i + 2] < 120) return (y * 400) / info.width;
    }
  }
  return null;
}

test("lời chúc 120 ký tự + 10 món: ảnh xem trước ≤60KB, dòng đầu ở đúng chỗ như lời chúc 1 dòng (không bị cắt mép trên)", async ({ page }) => {
  await openGift(page);
  await page.getByRole("button", { name: "Thêm Cam sành vào giỏ quà" }).click();
  await page.getByLabel("Lời chúc").fill(MSG120.slice(0, 16)); // "Kính chúc ông bà": 1 dòng
  const short = (await submitGift(page)).get("preview")!;
  const drawer = page.locator("#cart-drawer");
  await expect(drawer.getByText("Giỏ quà · 1 món")).toBeVisible();
  await drawer.getByRole("button", { name: "Đóng giỏ hàng" }).click();

  for (let i = 0; i < 10; i++) await page.getByRole("button", { name: "Thêm Cam sành vào giỏ quà" }).click();
  await page.getByLabel("Lời chúc").pressSequentially(MSG120); // gõ từng chữ: chữ xuống dòng lại nhiều lần
  await expect(page.getByLabel("Lời chúc")).toHaveValue(MSG120.slice(0, 120)); // maxLength 120
  const long = (await submitGift(page)).get("preview")!;
  expect(long.length).toBeLessThanOrEqual(60 * 1024);
  const [top1, top4] = [await firstInkRow(short), await firstInkRow(long)];
  expect(top1).toBeGreaterThan(8); // dưới mép trên (chữ đặt từ y=12)
  expect(Math.abs(top4! - top1!)).toBeLessThanOrEqual(2); // lời chúc dài mọc xuống dưới, dòng đầu không bị đẩy lên khỏi khung
});

test("kéo món xuống đáy giỏ (dưới thân trước): món vẫn nổi trên vành, toạ độ bị kẹp", async ({ page }) => {
  await openGift(page);
  await page.getByRole("button", { name: "Thêm Cam sành vào giỏ quà" }).click();
  await expect(page.getByRole("button", { name: /^Thêm vào giỏ hàng/ })).toBeEnabled(); // ảnh món đã lên canvas
  const box = (await page.locator("main canvas").last().boundingBox())!;
  const k = box.width / 400;
  await page.mouse.move(box.x + 200 * k, box.y + 224 * k);
  await page.mouse.down();
  for (let i = 1; i <= 10; i++) await page.mouse.move(box.x + (200 + 19 * i) * k, box.y + (224 + 17 * i) * k); // tới (390, 394)
  await page.mouse.up();
  const [item] = JSON.parse((await submitGift(page)).get("layout")!);
  expect(item.x).toBeLessThanOrEqual(372 / 400);
  expect(item.y).toBeLessThanOrEqual(0.713); // 285/400, làm tròn 3 chữ số
  expect(item.y).toBeGreaterThan(0.6); // đã kéo xuống thật (không phải đứng yên)
});

test("bàn phím: thêm món có thông báo (aria-live); bỏ món thì focus sang dòng kế tiếp, hết dòng về tiêu đề", async ({ page }) => {
  await openGift(page);
  const counter = page.getByText(/^Đã chọn \d+\/10 món$/);
  await expect(counter).toHaveAttribute("aria-live", "polite");
  await page.getByRole("button", { name: "Thêm Cam sành vào giỏ quà" }).press("Enter");
  await page.getByRole("button", { name: "Thêm Bơ 034 vào giỏ quà" }).press("Enter");
  await expect(counter).toHaveText("Đã chọn 2/10 món");
  await page.getByRole("button", { name: "Bỏ Cam sành khỏi giỏ quà" }).press("Enter");
  await expect(page.getByRole("button", { name: "Bỏ Bơ 034 khỏi giỏ quà" })).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("heading", { name: "Trong giỏ quà" })).toBeFocused();
  await expect(counter).toHaveText("Đã chọn 0/10 món");
});

test("lệnh giỏ hàng của drawer còn bay: 'Thêm vào giỏ hàng' khoá tới khi lệnh đó xong", async ({ page }) => {
  await addToCart(page, "rau-muong");
  await openGift(page);
  await page.getByRole("button", { name: "Thêm Cam sành vào giỏ quà" }).click();
  const cta = page.getByRole("button", { name: /^Thêm vào giỏ hàng/ });
  await expect(cta).toBeEnabled();
  await slowCartPosts(page, "after", 1500);
  const drawer = page.locator("#cart-drawer");
  await page.locator("#cart-button").click();
  await drawer.getByRole("button", { name: "Thêm 1 Rau muống" }).click();
  await drawer.getByRole("button", { name: "Đóng giỏ hàng" }).click();
  await expect(cta).toBeDisabled(); // hai lệnh cùng ghi cả cookie giỏ: lệnh về sau thắng
  await expect(cta).toBeEnabled({ timeout: 5000 });
});

test("thêm giỏ quà khi trang tải lại chậm: drawer mở lúc đã có dòng giỏ quà mới, không mở trên giỏ cũ", async ({ page }) => {
  await openGift(page);
  await page.getByRole("button", { name: "Thêm Cam sành vào giỏ quà" }).click();
  await page.route("**/*.data*", async (route) => {
    if (route.request().method() === "GET") await new Promise((r) => setTimeout(r, 1200)); // lượt tải lại sau action
    await route.continue().catch(() => {});
  });
  await submitGift(page);
  const shown = await page.waitForFunction(() => {
    const d = document.querySelector<HTMLDialogElement>("#cart-drawer");
    return d?.open ? d.textContent : null; // nội dung ĐÚNG lúc drawer mở
  });
  expect(await shown.jsonValue()).toContain("Giỏ quà · 1 món");
  await page.unrouteAll({ behavior: "ignoreErrors" });
});

test("lỗi từ server mất đi khi khách sửa lời chúc hoặc bỏ món", async ({ page }) => {
  await openGift(page);
  await page.getByRole("button", { name: "Thêm Cam sành vào giỏ quà" }).click();
  await page.route("**/gift.data*", async (route) => {
    if (route.request().method() !== "POST") return route.continue();
    const form = new URLSearchParams(route.request().postData() ?? "");
    form.set("preview", "data:image/svg+xml;base64,PHN2Zz4="); // server từ chối 400
    await route.continue({ postData: form.toString() });
  });
  const error = page.getByRole("alert").filter({ hasText: "Ảnh xem trước không hợp lệ" });
  await submitGift(page);
  await expect(error).toBeVisible();
  await page.getByLabel("Lời chúc").fill("Tặng bà");
  await expect(error).toHaveCount(0);
  await submitGift(page);
  await expect(error).toBeVisible();
  await page.getByRole("button", { name: "Bỏ Cam sành khỏi giỏ quà" }).click();
  await expect(error).toHaveCount(0);
});
