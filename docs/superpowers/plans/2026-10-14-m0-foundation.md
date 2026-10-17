# M0 Nền móng: Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. Load skill `react-router` trước khi đụng route/root, `prisma-cli` + `prisma-client-api` trước khi đụng Prisma. **Không** load `prisma-orm-setup` (skill đó kéo lên Prisma 8 RC).

**Goal:** Dựng khung app Chợ Sáng chạy được end-to-end: Postgres trong Docker, schema Prisma đầy đủ, seed 6 danh mục / 40 sản phẩm / 1 vỏ giỏ quà kèm ảnh đã xử lý, layout có header tìm kiếm, design tokens và font tiếng Việt.

**Architecture:** React Router 8 framework mode (SSR). `app/lib/*.server.ts` giữ code chỉ chạy server (env, db, ảnh). Seed là script tsx dùng lại đúng các module đó. Ảnh được sharp xử lý thành 6 biến thể vuông, lưu vào `uploads/` (không nằm trong `public/`).

**Tech Stack:** react-router 8.4.0, React 19.3.0, Vite 8.3.4, Tailwind 4.3.3, Prisma 7.10.0 + @prisma/adapter-pg, PostgreSQL 18.6-alpine, sharp 0.35.5, vitest 5.0.4, tsx 4.23.15, @fontsource (Be Vietnam Pro, Bricolage Grotesque), lucide-react 1.56.0.

**Spec:** [docs/superpowers/specs/2026-10-14-cho-sang-grocery-design.md](../specs/2026-10-14-cho-sang-grocery-design.md) (mục 4, 5, 6 dòng M0). Roadmap: [2026-10-14-cho-sang-roadmap.md](2026-10-14-cho-sang-roadmap.md) (hợp đồng module + phát hiện spike).

## Global Constraints

- Mọi dependency cài bằng `npm i -E` với **đúng** phiên bản trong plan. TypeScript **5.9.3**. Prisma **7.10.0**. Không bao giờ `@latest`.
- Node `>=22.22.0 <23`. Máy dev: 22.22.3.
- Cấm import `@remix-run/*`. Không thêm dependency ngoài danh sách của Task 1.
- Tiền là `Int` VND. Hiển thị qua `formatVnd()`.
- Tiếng Việt trên mọi chữ hiển thị.
- Palette chính xác: bg `#FAFAF5`, surface `#FFFFFF`, ink `#2A1B3D`, ink-muted `#5E5470`, line `#E4DFEA`, brand `#C8246B`, brand-press `#A61D58`, fresh `#2F7A34`, fresh-tint `#E8F3E6`, sun `#FFC83D`, danger `#B42318`.
- Font: Bricolage Grotesque 800 (display/giá) + Be Vietnam Pro 400/600 (body). Chỉ subset `latin` + `vietnamese`. Tổng ≤100KB.
- Không git. Mỗi task kết thúc bằng **Checkpoint**: `npm run typecheck && npm test` (từ Task 3 trở đi cần DB đang chạy).

## Review Focus

1. **Chạy lại `npm run setup` trên DB đã có dữ liệu** phải giữ đúng 41 sản phẩm và không lỗi. Test: Task 5 Step 6 chạy seed 2 lần và đếm.
2. **Chuỗi tìm kiếm dạng NFD, viết hoa, chữ Đ** vẫn chuẩn hoá về cùng một dạng. Test: Task 2 `toSearch` (có case NFD và `Đ`).
3. **Thiếu file ảnh nguồn của một sản phẩm** thì seed vẫn chạy và dùng placeholder có tên sản phẩm. Test: Task 4 test `placeholderImage` + Task 5 seed chạy khi `seed/images/products/` rỗng.
4. **Thiếu `.env` hoặc `DATABASE_URL`** phải báo lỗi tiếng Việt rõ ràng, không ra stack Prisma khó hiểu. Test: Task 3 test `required()`.
5. **Thêm ảnh thật sau khi đã seed bằng placeholder** thì seed lần sau phải thay ảnh (so mtime). Test: Task 7 Step 4 kiểm tra file output mới hơn file nguồn.

## File Structure

| File | Trách nhiệm |
|---|---|
| `package.json`, `.npmrc`, `tsconfig.json`, `vite.config.ts`, `vitest.config.ts`, `react-router.config.ts` | Cấu hình build/test |
| `compose.yaml` | Postgres 18 cho dev |
| `.env.example`, `.gitignore` | Biến môi trường mẫu; file bị bỏ qua |
| `prisma.config.ts`, `prisma/schema.prisma`, `prisma/migrations/*` | Schema đầy đủ + CHECK constraints |
| `prisma/catalog.ts` (+ `.test.ts`) | Dữ liệu seed thuần (không I/O) |
| `prisma/seed.ts` | Ghi catalog vào DB + xử lý ảnh, idempotent |
| `app/lib/env.server.ts` (+ test) | Đọc `.env`, validate biến bắt buộc |
| `app/lib/db.server.ts` (+ test) | Prisma client singleton |
| `app/lib/format.ts` (+ test) | `formatVnd`, `toSearch` |
| `app/lib/images.server.ts` (+ test) | sharp: 6 biến thể vuông, placeholder SVG |
| `app/app.css` | Tailwind + tokens + font + base styles |
| `app/root.tsx` | HTML shell, preload font, header/footer, ErrorBoundary |
| `app/components/site-header.tsx`, `site-footer.tsx` | Header dính có ô tìm kiếm; footer |
| `app/routes.ts`, `app/routes/home.tsx` | Trang chủ tạm (kiểm tra font + DB) |
| `seed/images/products/*.jpg`, `seed/images/CREDITS.md` | Ảnh nguồn minh hoạ (Task 8) |

---

### Task 1: Scaffold React Router 8 + dependencies

**Files:**
- Create: `package.json`, `.npmrc`, `tsconfig.json`, `vite.config.ts`, `vitest.config.ts`, `react-router.config.ts`, `.gitignore`, `app/routes.ts`, `app/root.tsx` (bản tối thiểu), `app/routes/home.tsx` (bản tối thiểu), `app/app.css` (bản tối thiểu)

**Interfaces:**
- Consumes: không có
- Produces: scripts `dev`, `build`, `start`, `typecheck`, `test`, `setup`; alias `~/*` → `app/*`

- [ ] **Step 1: Tạo `package.json`**

```json
{
  "name": "cho-sang",
  "private": true,
  "type": "module",
  "engines": { "node": ">=22.22.0 <23" },
  "scripts": {
    "dev": "react-router dev",
    "build": "react-router build",
    "start": "react-router-serve ./build/server/index.js",
    "typecheck": "react-router typegen && tsc",
    "test": "vitest run",
    "setup": "prisma generate && prisma migrate deploy && prisma db seed"
  }
}
```

- [ ] **Step 2: Tạo `.npmrc`**

```
save-exact=true
```

- [ ] **Step 3: Cài dependencies (đúng phiên bản)**

```bash
npm i -E --no-audit --no-fund react-router@8.4.0 @react-router/node@8.4.0 @react-router/serve@8.4.0 isbot@5.2.2 react@19.3.0 react-dom@19.3.0 @prisma/client@7.10.0 @prisma/adapter-pg@7.10.0 pg@8.23.1 sharp@0.35.5 lucide-react@1.56.0 @fontsource/be-vietnam-pro@5.3.0 @fontsource/bricolage-grotesque@5.3.0
npm i -D -E --no-audit --no-fund @react-router/dev@8.4.0 vite@8.3.4 tailwindcss@4.3.3 @tailwindcss/vite@4.3.3 typescript@5.9.3 @types/node@22.20.5 @types/react@19.3.0 @types/react-dom@19.3.0 @types/pg@8.23.1 prisma@7.10.0 tsx@4.23.15 vitest@5.0.4
```

(zod, three, fabric chưa cài: milestone dùng tới sẽ cài.)

- [ ] **Step 4: Cho phép install script (npm 12 chặn mặc định)**

```bash
npm install-scripts ls
npm install-scripts approve @prisma/engines esbuild prisma
npm rebuild
```

Expected: `npm install-scripts ls` sau khi approve không còn liệt kê gói nào. `package.json` có khối `allowScripts` với 3 gói trên. Nếu `ls` liệt kê thêm gói khác, **dừng lại và hỏi** (không tự approve).

- [ ] **Step 5: Tạo các file cấu hình**

`tsconfig.json`:
```json
{
  "include": ["**/*", "**/.server/**/*", "**/.client/**/*", ".react-router/types/**/*"],
  "compilerOptions": {
    "lib": ["DOM", "DOM.Iterable", "ES2022"],
    "types": ["node", "vite/client"],
    "target": "ES2022",
    "module": "ES2022",
    "moduleResolution": "bundler",
    "jsx": "react-jsx",
    "rootDirs": [".", "./.react-router/types"],
    "paths": { "~/*": ["./app/*"] },
    "esModuleInterop": true,
    "verbatimModuleSyntax": true,
    "noEmit": true,
    "resolveJsonModule": true,
    "skipLibCheck": true,
    "strict": true
  }
}
```

`vite.config.ts`:
```ts
import { reactRouter } from "@react-router/dev/vite";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [tailwindcss(), reactRouter()],
  resolve: { tsconfigPaths: true },
});
```

`vitest.config.ts`:
```ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: { tsconfigPaths: true },
  test: { include: ["app/**/*.test.ts", "prisma/**/*.test.ts"] },
});
```

`react-router.config.ts`:
```ts
import type { Config } from "@react-router/dev/config";

export default { ssr: true } satisfies Config;
```

`.gitignore`:
```
.DS_Store
.env
/node_modules/
/.react-router/
/build/
/app/generated/
/uploads/
```

- [ ] **Step 6: Tạo app tối thiểu**

`app/app.css`:
```css
@import "tailwindcss";
```

`app/routes.ts`:
```ts
import { type RouteConfig, index } from "@react-router/dev/routes";

export default [index("routes/home.tsx")] satisfies RouteConfig;
```

`app/root.tsx`:
```tsx
import { Links, Meta, Outlet, Scripts, ScrollRestoration } from "react-router";
import "./app.css";

export function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="vi">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <Meta />
        <Links />
      </head>
      <body>
        {children}
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  );
}

export default function App() {
  return <Outlet />;
}
```

`app/routes/home.tsx`:
```tsx
export default function Home() {
  return <h1>Chợ Sáng</h1>;
}
```

- [ ] **Step 7: Kiểm tra typecheck + dev server**

```bash
npm run typecheck
npm run dev -- --port 5173 &
sleep 5 && curl -s localhost:5173/ | grep -o '<h1>Chợ Sáng</h1>'
kill %1
```

Expected: typecheck không lỗi; curl in ra `<h1>Chợ Sáng</h1>`.

- [ ] **Step 8: Checkpoint**: `npm run typecheck` pass.

---

### Task 2: `formatVnd` + `toSearch` (TDD)

**Files:**
- Create: `app/lib/format.ts`
- Test: `app/lib/format.test.ts`

**Interfaces:**
- Produces: `formatVnd(n: number): string` → `"312.000₫"` (không có khoảng trắng trước ₫); `toSearch(s: string): string` (bỏ dấu, `đ/Đ → d`, chữ thường, trim).

- [ ] **Step 1: Viết test fail**

```ts
import { describe, expect, test } from "vitest";
import { formatVnd, toSearch } from "~/lib/format";

describe("formatVnd", () => {
  test("nhóm nghìn bằng dấu chấm, ký hiệu ₫ dính liền", () => {
    expect(formatVnd(312000)).toBe("312.000₫");
    expect(formatVnd(1250000)).toBe("1.250.000₫");
  });
  test("số 0", () => {
    expect(formatVnd(0)).toBe("0₫");
  });
});

describe("toSearch", () => {
  test("bỏ dấu và viết thường", () => {
    expect(toSearch("Trứng gà ta")).toBe("trung ga ta");
    expect(toSearch("Bưởi Diễn")).toBe("buoi dien");
  });
  test("đ và Đ thành d", () => {
    expect(toSearch("Đậu hũ non")).toBe("dau hu non");
    expect(toSearch("đường mía")).toBe("duong mia");
  });
  test("chuỗi NFD (dấu tổ hợp) cho cùng kết quả", () => {
    expect(toSearch("Sữa tươi".normalize("NFD"))).toBe("sua tuoi");
  });
  test("trim khoảng trắng", () => {
    expect(toSearch("  Rau muống ")).toBe("rau muong");
  });
});
```

- [ ] **Step 2: Chạy test, xác nhận fail**

Run: `npx vitest run app/lib/format.test.ts`
Expected: FAIL, `Failed to resolve import "~/lib/format"`.

- [ ] **Step 3: Implement**

```ts
const vnd = new Intl.NumberFormat("vi-VN");

export const formatVnd = (n: number) => `${vnd.format(n)}₫`;

export const toSearch = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[đĐ]/g, "d")
    .toLowerCase()
    .trim();
```

- [ ] **Step 4: Chạy test, xác nhận pass**

Run: `npx vitest run app/lib/format.test.ts`
Expected: PASS 6 tests.

- [ ] **Step 5: Checkpoint**: `npm run typecheck && npm test`.

---

### Task 3: Postgres + Prisma schema đầy đủ + env/db

**Files:**
- Create: `compose.yaml`, `.env.example`, `.env` (copy), `prisma.config.ts`, `prisma/schema.prisma`, `prisma/migrations/<ts>_init/migration.sql` (sinh ra rồi sửa), `app/lib/env.server.ts`, `app/lib/db.server.ts`
- Test: `app/lib/env.server.test.ts`, `app/lib/db.server.test.ts`

**Interfaces:**
- Produces: `env: { DATABASE_URL: string; UPLOAD_DIR: string }`, `required(name: string): string`, `db: PrismaClient` (import từ `~/lib/db.server`), types từ `~/generated/prisma/client`.

- [ ] **Step 1: `compose.yaml`**

```yaml
services:
  db:
    image: postgres:18.6-alpine
    environment:
      POSTGRES_USER: chosang
      POSTGRES_PASSWORD: chosang
      POSTGRES_DB: chosang
    ports: ["5432:5432"]
    # Postgres 18 đổi PGDATA thành /var/lib/postgresql/18/docker: mount thư mục cha
    volumes: ["pgdata:/var/lib/postgresql"]
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U chosang"]
      interval: 2s
      retries: 15
volumes:
  pgdata:
```

- [ ] **Step 2: `.env.example` và `.env`**

```
DATABASE_URL=postgresql://chosang:chosang@localhost:5432/chosang
UPLOAD_DIR=uploads
```

```bash
cp .env.example .env
docker compose up -d --wait db
```

Expected: `Container ...-db-1 Healthy`. Nếu cổng 5432 bận thì đổi cả `ports` lẫn `DATABASE_URL` sang 5434.

- [ ] **Step 3: Viết test fail cho env**

`app/lib/env.server.test.ts`:
```ts
import { expect, test } from "vitest";
import { required } from "~/lib/env.server";

test("required báo lỗi tiếng Việt khi thiếu biến", () => {
  expect(() => required("__CHO_SANG_KHONG_CO__")).toThrow(
    "__CHO_SANG_KHONG_CO__ chưa được đặt, hãy copy .env.example thành .env",
  );
});

test("required trả giá trị khi có", () => {
  process.env.__CHO_SANG_CO__ = "x";
  expect(required("__CHO_SANG_CO__")).toBe("x");
});
```

Run: `npx vitest run app/lib/env.server.test.ts`. Expected: FAIL (module chưa có).

- [ ] **Step 4: `app/lib/env.server.ts`**

```ts
// Dev: đọc .env (biến đã có trong môi trường được giữ nguyên). Production truyền env thật.
try {
  process.loadEnvFile();
} catch {}

export function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} chưa được đặt, hãy copy .env.example thành .env`);
  return value;
}

export const env = {
  DATABASE_URL: required("DATABASE_URL"),
  UPLOAD_DIR: process.env.UPLOAD_DIR || "uploads",
};
```

Run: `npx vitest run app/lib/env.server.test.ts`. Expected: PASS.

- [ ] **Step 5: `prisma.config.ts`**

```ts
import { defineConfig, env } from "prisma/config";

try {
  process.loadEnvFile();
} catch {}

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: { path: "prisma/migrations", seed: "tsx prisma/seed.ts" },
  datasource: { url: env("DATABASE_URL") },
});
```

- [ ] **Step 6: `prisma/schema.prisma` (đầy đủ theo spec mục 5)**

```prisma
generator client {
  provider = "prisma-client"
  output   = "../app/generated/prisma"
}

datasource db {
  provider = "postgresql"
}

enum Role {
  customer
  admin
}

enum PaymentMethod {
  cod
  online_mock
}

enum PaymentStatus {
  unpaid
  paid
  failed
}

enum OrderStatus {
  pending
  preparing
  shipping
  done
  cancelled
}

model User {
  id        Int      @id @default(autoincrement())
  phone     String   @unique
  name      String?
  email     String?
  role      Role     @default(customer)
  createdAt DateTime @default(now())
  orders    Order[]
}

model Category {
  id       Int       @id @default(autoincrement())
  slug     String    @unique
  name     String
  image    String
  sort     Int       @default(0)
  products Product[]
}

model Product {
  id           Int          @id @default(autoincrement())
  slug         String       @unique
  name         String
  nameSearch   String
  description  String
  categoryId   Int
  category     Category     @relation(fields: [categoryId], references: [id])
  priceVnd     Int
  compareAtVnd Int?
  unit         String
  netGrams     Int?
  isWeighed    Boolean      @default(false)
  origin       String
  shelfLife    String
  storage      String
  stock        Int          @default(0)
  images       String[]
  cutoutUrl    String?
  isGiftBase   Boolean      @default(false)
  isActive     Boolean      @default(true)
  createdAt    DateTime     @default(now())
  orderItems   OrderItem[]
  giftBundles  GiftBundle[]

  @@index([categoryId])
}

model Order {
  id               Int           @id @default(autoincrement())
  code             String        @unique
  userId           Int?
  user             User?         @relation(fields: [userId], references: [id])
  customerName     String
  phone            String
  address          String
  note             String        @default("")
  callOnSubstitute Boolean       @default(false)
  deliveryDate     DateTime      @db.Date
  deliverySlot     String
  subtotalVnd      Int
  shippingVnd      Int
  totalVnd         Int
  paymentMethod    PaymentMethod
  paymentStatus    PaymentStatus @default(unpaid)
  status           OrderStatus   @default(pending)
  createdAt        DateTime      @default(now())
  preparingAt      DateTime?
  shippingAt       DateTime?
  doneAt           DateTime?
  cancelledAt      DateTime?
  items            OrderItem[]

  @@index([phone])
  @@index([userId])
}

model OrderItem {
  id               Int         @id @default(autoincrement())
  orderId          Int
  order            Order       @relation(fields: [orderId], references: [id], onDelete: Cascade)
  productId        Int
  product          Product     @relation(fields: [productId], references: [id])
  bundleId         String?
  bundle           GiftBundle? @relation(fields: [bundleId], references: [id])
  nameSnapshot     String
  unitSnapshot     String
  priceSnapshotVnd Int
  qty              Int

  @@index([orderId])
}

model GiftBundle {
  id            String      @id @default(cuid())
  baseProductId Int
  baseProduct   Product     @relation(fields: [baseProductId], references: [id])
  layout        Json
  message       String      @default("")
  preview       String
  createdAt     DateTime    @default(now())
  orderItems    OrderItem[]
}
```

- [ ] **Step 7: Tạo migration, thêm CHECK, áp dụng, generate**

```bash
npx prisma migrate dev --name init --create-only
```

Mở `prisma/migrations/<timestamp>_init/migration.sql`, thêm vào **cuối file**:
```sql
-- Kho không bao giờ âm; số lượng dòng đơn luôn dương (spec mục 5)
ALTER TABLE "Product" ADD CONSTRAINT "Product_stock_nonnegative" CHECK ("stock" >= 0);
ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_qty_positive" CHECK ("qty" > 0);
```

```bash
npx prisma migrate dev
npx prisma generate
```

Expected: `Your database is now in sync with your schema.` rồi `Generated Prisma Client (7.10.0) to ./app/generated/prisma`. (Prisma 7 **không** tự generate sau migrate.)

- [ ] **Step 8: `app/lib/db.server.ts`**

```ts
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "~/generated/prisma/client";
import { env } from "./env.server";

export const db = new PrismaClient({
  adapter: new PrismaPg({ connectionString: env.DATABASE_URL }),
});
```

- [ ] **Step 9: Test DB chặn kho âm**

`app/lib/db.server.test.ts`:
```ts
import { afterAll, expect, test } from "vitest";
import { db } from "~/lib/db.server";

const slug = "__test-stock-check__";

afterAll(async () => {
  await db.product.deleteMany({ where: { slug } });
  await db.category.deleteMany({ where: { slug } });
  await db.$disconnect();
});

test("Postgres từ chối kho âm", async () => {
  const category = await db.category.create({ data: { slug, name: "test", image: "x" } });
  const product = await db.product.create({
    data: {
      slug, name: "test", nameSearch: "test", description: "", categoryId: category.id,
      priceVnd: 1000, unit: "cái", origin: "x", shelfLife: "x", storage: "x", stock: 0,
    },
  });
  await expect(
    db.product.update({ where: { id: product.id }, data: { stock: { decrement: 1 } } }),
  ).rejects.toThrow();
});
```

Run: `npx vitest run app/lib/db.server.test.ts`. Expected: PASS.

- [ ] **Step 10: Checkpoint**: `npm run typecheck && npm test` (DB đang chạy).

---

### Task 4: Pipeline ảnh (sharp)

**Files:**
- Create: `app/lib/images.server.ts`
- Test: `app/lib/images.server.test.ts`

**Interfaces:**
- Produces: `IMAGE_WIDTHS = [320, 640, 1080]`, `IMAGE_FORMATS = ["avif", "webp"]`, `saveSquareImage(input: Buffer | string, outDir: string, name: string): Promise<void>` (ghi `${outDir}/${name}-${w}.${fmt}`), `placeholderImage(label: string, bg: string): Buffer` (SVG 1080×1080).

- [ ] **Step 1: Viết test fail**

```ts
import { mkdtemp, readdir, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import sharp from "sharp";
import { afterAll, expect, test } from "vitest";
import { placeholderImage, saveSquareImage } from "~/lib/images.server";

const dirs: string[] = [];
afterAll(() => Promise.all(dirs.map((d) => rm(d, { recursive: true, force: true }))));

test("saveSquareImage ghi 6 biến thể vuông từ ảnh ngang", async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), "chosang-img-"));
  dirs.push(dir);
  const input = await sharp({
    create: { width: 1200, height: 800, channels: 3, background: "#C8246B" },
  }).png().toBuffer();

  await saveSquareImage(input, dir, "ca-chua");

  expect((await readdir(dir)).sort()).toEqual([
    "ca-chua-1080.avif", "ca-chua-1080.webp",
    "ca-chua-320.avif", "ca-chua-320.webp",
    "ca-chua-640.avif", "ca-chua-640.webp",
  ]);
  const meta = await sharp(path.join(dir, "ca-chua-640.webp")).metadata();
  expect([meta.width, meta.height]).toEqual([640, 640]);
});

test("placeholderImage render được nhãn tiếng Việt và ký tự đặc biệt", async () => {
  const meta = await sharp(placeholderImage("Bưởi Diễn & <Cam>", "#E8F3E6")).metadata();
  expect([meta.width, meta.height]).toEqual([1080, 1080]);
});
```

Run: `npx vitest run app/lib/images.server.test.ts`. Expected: FAIL (module chưa có).

- [ ] **Step 2: Implement**

```ts
import { mkdir } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

export const IMAGE_WIDTHS = [320, 640, 1080] as const;
export const IMAGE_FORMATS = ["avif", "webp"] as const;

/** Cắt vuông (ưu tiên vùng nổi bật) và ghi 3 cỡ × 2 định dạng. */
export async function saveSquareImage(input: Buffer | string, outDir: string, name: string) {
  await mkdir(outDir, { recursive: true });
  const source = sharp(input).rotate(); // xoay theo EXIF của ảnh điện thoại
  await Promise.all(
    IMAGE_WIDTHS.flatMap((w) =>
      IMAGE_FORMATS.map((fmt) =>
        source
          .clone()
          .resize(w, w, { fit: "cover", position: sharp.strategy.attention })
          .toFormat(fmt, { quality: fmt === "avif" ? 50 : 75 })
          .toFile(path.join(outDir, `${name}-${w}.${fmt}`)),
      ),
    ),
  );
}

const escapeXml = (s: string) => s.replace(/[&<>"]/g, (c) => `&#${c.charCodeAt(0)};`);

/** Ảnh tạm khi chưa có ảnh nguồn: nền màu danh mục + tên sản phẩm. */
export function placeholderImage(label: string, bg: string): Buffer {
  return Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="1080">` +
      `<rect width="100%" height="100%" fill="${bg}"/>` +
      `<text x="50%" y="50%" text-anchor="middle" dominant-baseline="middle" font-family="sans-serif" font-size="72" font-weight="700" fill="#2A1B3D">${escapeXml(label)}</text>` +
      `</svg>`,
  );
}
```

- [ ] **Step 3: Chạy test**

Run: `npx vitest run app/lib/images.server.test.ts`. Expected: PASS 2 tests.

- [ ] **Step 4: Checkpoint**: `npm run typecheck && npm test`.

---

### Task 5: Catalog + seed idempotent

**Files:**
- Create: `prisma/catalog.ts`, `prisma/seed.ts`
- Test: `prisma/catalog.test.ts`

**Interfaces:**
- Consumes: `db`, `env.UPLOAD_DIR`, `toSearch`, `saveSquareImage`, `placeholderImage`
- Produces: `categories: CatalogCategory[]` (6), `products: CatalogProduct[]` (40), `giftBase: CatalogProduct` (`isGiftBase`); DB có 6 Category + 41 Product; ảnh ở `uploads/products/<slug>-*`; `Product.images = ["products/<slug>"]`; `Category.image = "products/<cover-slug>"`.

- [ ] **Step 1: Viết test fail cho catalog**

`prisma/catalog.test.ts`:
```ts
import { expect, test } from "vitest";
import { categories, giftBase, products } from "./catalog";

const all = [...products, giftBase];

test("đủ số lượng: 6 danh mục, 40 sản phẩm + 1 vỏ giỏ", () => {
  expect(categories).toHaveLength(6);
  expect(products).toHaveLength(40);
  expect(giftBase.isGiftBase).toBe(true);
  expect(products.every((p) => !p.isGiftBase)).toBe(true);
});

test("slug duy nhất, dạng kebab không dấu", () => {
  const slugs = all.map((p) => p.slug);
  expect(new Set(slugs).size).toBe(slugs.length);
  for (const s of [...slugs, ...categories.map((c) => c.slug)]) expect(s).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
});

test("mỗi sản phẩm thuộc danh mục có thật; mỗi danh mục có ảnh bìa là sản phẩm có thật", () => {
  const catSlugs = new Set(categories.map((c) => c.slug));
  for (const p of all) expect(catSlugs).toContain(p.category);
  const productSlugs = new Set(products.map((p) => p.slug));
  for (const c of categories) expect(productSlugs).toContain(c.cover);
});

test("tiền là số nguyên dương; giá gạch lớn hơn giá bán; kho không âm", () => {
  for (const p of all) {
    expect(Number.isInteger(p.priceVnd) && p.priceVnd > 0).toBe(true);
    if (p.compareAtVnd !== undefined) expect(p.compareAtVnd).toBeGreaterThan(p.priceVnd);
    expect(Number.isInteger(p.stock) && p.stock >= 0).toBe(true);
  }
});

test("hàng cân ký phải có netGrams", () => {
  for (const p of all.filter((p) => p.isWeighed)) expect(p.netGrams).toBeGreaterThan(0);
});

test("demo có ít nhất 1 món hết hàng và 3 món khuyến mãi", () => {
  expect(products.some((p) => p.stock === 0)).toBe(true);
  expect(products.filter((p) => p.compareAtVnd !== undefined).length).toBeGreaterThanOrEqual(3);
});
```

Run: `npx vitest run prisma/catalog.test.ts`. Expected: FAIL (module chưa có).

- [ ] **Step 2: `prisma/catalog.ts`**

```ts
export type CatalogCategory = {
  slug: string;
  name: string;
  sort: number;
  color: string; // nền placeholder
  cover: string; // slug sản phẩm làm ảnh danh mục
};

export type CatalogProduct = {
  slug: string;
  name: string;
  category: string;
  priceVnd: number;
  compareAtVnd?: number;
  unit: string;
  netGrams?: number;
  isWeighed: boolean;
  origin: string;
  shelfLife: string;
  storage: string;
  stock: number;
  description: string;
  isGiftBase?: boolean;
};

export const categories: CatalogCategory[] = [
  { slug: "rau-cu", name: "Rau củ", sort: 1, color: "#E8F3E6", cover: "cai-ngot" },
  { slug: "trai-cay", name: "Trái cây", sort: 2, color: "#FFF1C9", cover: "xoai-cat-hoa-loc" },
  { slug: "thit-ca", name: "Thịt cá", sort: 3, color: "#FBE3EC", cover: "ca-hoi-phi-le" },
  { slug: "trung-sua", name: "Trứng & sữa", sort: 4, color: "#F3F0F7", cover: "trung-ga-ta" },
  { slug: "banh-mi-do-kho", name: "Bánh mì & đồ khô", sort: 5, color: "#F6EBDD", cover: "gao-st25" },
  { slug: "gia-vi", name: "Gia vị", sort: 6, color: "#FDE7E3", cover: "nuoc-mam-phu-quoc" },
];

const FRIDGE = "Ngăn mát tủ lạnh 2–5°C";
const DRY = "Nơi khô ráo, thoáng mát, tránh nắng";
const MEAT = "Ngăn mát 0–4°C, dùng trong 2 ngày hoặc cấp đông";

export const products: CatalogProduct[] = [
  // Rau củ
  { slug: "rau-muong", name: "Rau muống", category: "rau-cu", priceVnd: 15000, unit: "bó ~300g", netGrams: 300, isWeighed: true, origin: "Củ Chi, TP.HCM", shelfLife: "2 ngày", storage: FRIDGE, stock: 60, description: "Rau muống ta cọng nhỏ, hái sáng sớm, hợp xào tỏi hoặc luộc chấm mắm." },
  { slug: "cai-ngot", name: "Cải ngọt VietGAP", category: "rau-cu", priceVnd: 18000, unit: "bó ~300g", netGrams: 300, isWeighed: true, origin: "Đà Lạt, VietGAP", shelfLife: "3 ngày", storage: FRIDGE, stock: 45, description: "Cải ngọt lá non, trồng theo chuẩn VietGAP, nấu canh hay xào đều ngọt." },
  { slug: "ca-chua-bi", name: "Cà chua bi", category: "rau-cu", priceVnd: 32000, compareAtVnd: 39000, unit: "hộp 300g", netGrams: 300, isWeighed: false, origin: "Đà Lạt", shelfLife: "5 ngày", storage: FRIDGE, stock: 40, description: "Cà chua bi đỏ mọng, vị chua ngọt, ăn sống hoặc trộn salad." },
  { slug: "khoai-lang-nhat", name: "Khoai lang Nhật", category: "rau-cu", priceVnd: 35000, unit: "túi ~1kg", netGrams: 1000, isWeighed: true, origin: "Đà Lạt", shelfLife: "14 ngày", storage: DRY, stock: 50, description: "Khoai lang vỏ tím ruột vàng, nướng hoặc hấp đều dẻo bùi." },
  { slug: "ca-rot", name: "Cà rốt", category: "rau-cu", priceVnd: 22000, unit: "túi ~500g", netGrams: 500, isWeighed: true, origin: "Đà Lạt", shelfLife: "10 ngày", storage: FRIDGE, stock: 55, description: "Cà rốt củ đều, giòn ngọt, hợp nấu canh, ép nước hay làm đồ chua." },
  { slug: "bi-do-ho-lo", name: "Bí đỏ hồ lô", category: "rau-cu", priceVnd: 25000, unit: "quả ~1kg", netGrams: 1000, isWeighed: true, origin: "Lâm Đồng", shelfLife: "14 ngày", storage: DRY, stock: 30, description: "Bí đỏ hồ lô ruột dày, nấu canh hoặc làm súp đều béo." },
  { slug: "dua-leo", name: "Dưa leo", category: "rau-cu", priceVnd: 19000, unit: "túi ~500g", netGrams: 500, isWeighed: true, origin: "Củ Chi, TP.HCM", shelfLife: "5 ngày", storage: FRIDGE, stock: 50, description: "Dưa leo trái nhỏ, giòn, ít hạt, ăn kèm cơm hoặc làm salad." },
  { slug: "hanh-la", name: "Hành lá", category: "rau-cu", priceVnd: 8000, unit: "bó 100g", netGrams: 100, isWeighed: false, origin: "Hóc Môn, TP.HCM", shelfLife: "3 ngày", storage: FRIDGE, stock: 80, description: "Hành lá tươi, rửa sạch để ráo, gói giấy rồi cất ngăn mát." },
  // Trái cây
  { slug: "buoi-dien", name: "Bưởi Diễn", category: "trai-cay", priceVnd: 75000, unit: "quả ~1,2kg", netGrams: 1200, isWeighed: true, origin: "Phú Diễn, Hà Nội", shelfLife: "14 ngày", storage: DRY, stock: 25, description: "Bưởi Diễn vỏ mỏng, múi vàng ráo nước, ngọt thanh." },
  { slug: "xoai-cat-hoa-loc", name: "Xoài cát Hòa Lộc", category: "trai-cay", priceVnd: 85000, compareAtVnd: 99000, unit: "túi ~1kg", netGrams: 1000, isWeighed: true, origin: "Cái Bè, Tiền Giang", shelfLife: "5 ngày", storage: "Để nhiệt độ phòng cho chín, chín rồi cất ngăn mát", stock: 35, description: "Xoài cát Hòa Lộc thơm đậm, thịt mịn không xơ." },
  { slug: "thanh-long-ruot-do", name: "Thanh long ruột đỏ", category: "trai-cay", priceVnd: 45000, unit: "túi ~1kg", netGrams: 1000, isWeighed: true, origin: "Hàm Thuận Nam, Bình Thuận", shelfLife: "7 ngày", storage: FRIDGE, stock: 40, description: "Thanh long ruột đỏ ngọt đậm, ướp lạnh ăn rất mát." },
  { slug: "cam-sanh", name: "Cam sành", category: "trai-cay", priceVnd: 39000, unit: "túi ~1kg", netGrams: 1000, isWeighed: true, origin: "Tam Bình, Vĩnh Long", shelfLife: "10 ngày", storage: FRIDGE, stock: 60, description: "Cam sành mọng nước, chua ngọt, chuyên vắt nước." },
  { slug: "tao-envy", name: "Táo Envy", category: "trai-cay", priceVnd: 159000, unit: "túi ~1kg", netGrams: 1000, isWeighed: true, origin: "Nhập khẩu New Zealand", shelfLife: "21 ngày", storage: FRIDGE, stock: 0, description: "Táo Envy giòn ngọt, thịt trắng lâu thâm." },
  { slug: "nho-xanh-ninh-thuan", name: "Nho xanh Ninh Thuận", category: "trai-cay", priceVnd: 89000, unit: "hộp 500g", netGrams: 500, isWeighed: false, origin: "Ninh Thuận", shelfLife: "5 ngày", storage: FRIDGE, stock: 3, description: "Nho xanh giòn, chua nhẹ, rửa ngay trước khi ăn." },
  { slug: "chuoi-gia", name: "Chuối già Nam Mỹ", category: "trai-cay", priceVnd: 32000, unit: "nải ~1kg", netGrams: 1000, isWeighed: true, origin: "Đồng Nai", shelfLife: "5 ngày", storage: "Nhiệt độ phòng, treo nơi thoáng", stock: 45, description: "Chuối già vỏ vàng đều, ngọt mềm, ăn sáng tiện lợi." },
  { slug: "bo-034", name: "Bơ 034", category: "trai-cay", priceVnd: 69000, unit: "túi ~1kg", netGrams: 1000, isWeighed: true, origin: "Krông Pắc, Đắk Lắk", shelfLife: "5 ngày", storage: "Để nhiệt độ phòng đến khi chín, chín rồi cất ngăn mát", stock: 30, description: "Bơ 034 trái dài, cơm vàng dẻo, béo ngậy." },
  // Thịt cá
  { slug: "ba-roi-heo", name: "Ba rọi heo", category: "thit-ca", priceVnd: 79000, unit: "khay ~500g", netGrams: 500, isWeighed: true, origin: "Đồng Nai", shelfLife: "2 ngày (ngăn mát)", storage: MEAT, stock: 30, description: "Ba rọi nạc mỡ xen kẽ, hợp kho tộ, luộc hoặc nướng." },
  { slug: "than-bo-noi", name: "Thăn bò nội", category: "thit-ca", priceVnd: 145000, unit: "khay ~300g", netGrams: 300, isWeighed: true, origin: "Tây Ninh", shelfLife: "2 ngày (ngăn mát)", storage: MEAT, stock: 20, description: "Thăn bò mềm, ít gân, hợp xào hoặc áp chảo." },
  { slug: "uc-ga-phi-le", name: "Ức gà phi lê", category: "thit-ca", priceVnd: 49000, unit: "khay ~500g", netGrams: 500, isWeighed: true, origin: "Bình Dương", shelfLife: "2 ngày (ngăn mát)", storage: MEAT, stock: 35, description: "Ức gà phi lê bỏ da, nhiều đạm, ít mỡ." },
  { slug: "ca-hoi-phi-le", name: "Cá hồi phi lê", category: "thit-ca", priceVnd: 159000, compareAtVnd: 179000, unit: "khay ~300g", netGrams: 300, isWeighed: true, origin: "Nhập khẩu Na Uy", shelfLife: "2 ngày (ngăn mát)", storage: "Ngăn mát 0–2°C", stock: 15, description: "Cá hồi phi lê thịt cam đỏ, áp chảo hoặc làm sashimi." },
  { slug: "tom-the", name: "Tôm thẻ", category: "thit-ca", priceVnd: 129000, unit: "khay ~500g", netGrams: 500, isWeighed: true, origin: "Năm Căn, Cà Mau", shelfLife: "2 ngày (ngăn mát)", storage: MEAT, stock: 25, description: "Tôm thẻ size 40–50 con/kg, thịt chắc ngọt." },
  { slug: "ca-basa-cat-khuc", name: "Cá basa cắt khúc", category: "thit-ca", priceVnd: 59000, unit: "khay ~500g", netGrams: 500, isWeighed: true, origin: "Châu Đốc, An Giang", shelfLife: "2 ngày (ngăn mát)", storage: MEAT, stock: 30, description: "Cá basa cắt khúc sẵn, hợp kho tộ hoặc nấu canh chua." },
  // Trứng & sữa
  { slug: "trung-ga-ta", name: "Trứng gà ta", category: "trung-sua", priceVnd: 39000, unit: "hộp 10 quả", isWeighed: false, origin: "Trảng Bom, Đồng Nai", shelfLife: "21 ngày", storage: FRIDGE, stock: 70, description: "Trứng gà ta lòng đỏ đậm, ngày đóng gói in trên hộp." },
  { slug: "trung-vit", name: "Trứng vịt", category: "trung-sua", priceVnd: 35000, unit: "hộp 10 quả", isWeighed: false, origin: "Tháp Mười, Đồng Tháp", shelfLife: "21 ngày", storage: FRIDGE, stock: 50, description: "Trứng vịt tươi, hợp chiên, luộc hoặc làm bánh." },
  { slug: "sua-tuoi-khong-duong", name: "Sữa tươi không đường", category: "trung-sua", priceVnd: 36000, unit: "lốc 4 hộp 180ml", isWeighed: false, origin: "Mộc Châu, Sơn La", shelfLife: "6 tháng", storage: "Nơi khô ráo; sau khi mở cất ngăn mát, dùng trong 24h", stock: 80, description: "Sữa tươi tiệt trùng không đường, vị thanh tự nhiên." },
  { slug: "sua-chua-co-duong", name: "Sữa chua có đường", category: "trung-sua", priceVnd: 28000, unit: "lốc 4 hộp 100g", isWeighed: false, origin: "Ba Vì, Hà Nội", shelfLife: "30 ngày", storage: FRIDGE, stock: 60, description: "Sữa chua mịn, chua dịu, ăn lạnh ngon nhất." },
  { slug: "pho-mai-lat", name: "Phô mai lát", category: "trung-sua", priceVnd: 65000, compareAtVnd: 72000, unit: "gói 200g", netGrams: 200, isWeighed: false, origin: "Nhập khẩu Úc", shelfLife: "6 tháng", storage: FRIDGE, stock: 25, description: "Phô mai cheddar lát mỏng, kẹp bánh mì hoặc làm hamburger." },
  { slug: "dau-hu-non", name: "Đậu hũ non", category: "trung-sua", priceVnd: 12000, unit: "hộp 300g", netGrams: 300, isWeighed: false, origin: "TP.HCM", shelfLife: "3 ngày", storage: FRIDGE, stock: 40, description: "Đậu hũ non mềm mịn, nấu canh hoặc hấp xì dầu." },
  // Bánh mì & đồ khô
  { slug: "banh-mi-sandwich", name: "Bánh mì sandwich", category: "banh-mi-do-kho", priceVnd: 25000, unit: "gói 400g", netGrams: 400, isWeighed: false, origin: "TP.HCM", shelfLife: "5 ngày", storage: DRY, stock: 30, description: "Bánh mì sandwich mềm, nướng sơ ăn sáng cùng trứng." },
  { slug: "gao-st25", name: "Gạo ST25", category: "banh-mi-do-kho", priceVnd: 189000, compareAtVnd: 210000, unit: "túi 5kg", netGrams: 5000, isWeighed: false, origin: "Sóc Trăng", shelfLife: "12 tháng", storage: DRY, stock: 40, description: "Gạo ST25 hạt dài, cơm dẻo thơm, để nguội vẫn mềm." },
  { slug: "mi-trung", name: "Mì trứng", category: "banh-mi-do-kho", priceVnd: 18000, unit: "gói 500g", netGrams: 500, isWeighed: false, origin: "Bình Dương", shelfLife: "12 tháng", storage: DRY, stock: 60, description: "Mì trứng sợi nhỏ, trụng nhanh, hợp mì xào hoặc mì nước." },
  { slug: "yen-mach-can-det", name: "Yến mạch cán dẹt", category: "banh-mi-do-kho", priceVnd: 79000, unit: "túi 1kg", netGrams: 1000, isWeighed: false, origin: "Nhập khẩu Úc", shelfLife: "12 tháng", storage: DRY, stock: 35, description: "Yến mạch cán dẹt nguyên hạt, nấu cháo hoặc ngâm qua đêm." },
  { slug: "hat-dieu-rang-muoi", name: "Hạt điều rang muối", category: "banh-mi-do-kho", priceVnd: 149000, unit: "hũ 500g", netGrams: 500, isWeighed: false, origin: "Bình Phước", shelfLife: "6 tháng", storage: DRY, stock: 20, description: "Hạt điều nguyên hạt rang muối, giòn béo." },
  { slug: "banh-trang-trang-bang", name: "Bánh tráng Trảng Bàng", category: "banh-mi-do-kho", priceVnd: 22000, unit: "gói 300g", netGrams: 300, isWeighed: false, origin: "Trảng Bàng, Tây Ninh", shelfLife: "6 tháng", storage: DRY, stock: 45, description: "Bánh tráng phơi sương dẻo mềm, cuốn thịt luộc rau sống." },
  // Gia vị
  { slug: "nuoc-mam-phu-quoc", name: "Nước mắm Phú Quốc 40 độ đạm", category: "gia-vi", priceVnd: 89000, unit: "chai 500ml", isWeighed: false, origin: "Phú Quốc, Kiên Giang", shelfLife: "24 tháng", storage: DRY, stock: 40, description: "Nước mắm cá cơm 40 độ đạm, màu cánh gián, mặn hậu ngọt." },
  { slug: "dau-an-dau-nanh", name: "Dầu ăn đậu nành", category: "gia-vi", priceVnd: 59000, unit: "chai 1L", isWeighed: false, origin: "Việt Nam", shelfLife: "18 tháng", storage: DRY, stock: 50, description: "Dầu đậu nành tinh luyện, chiên xào không khói." },
  { slug: "duong-mia", name: "Đường mía", category: "gia-vi", priceVnd: 28000, unit: "túi 1kg", netGrams: 1000, isWeighed: false, origin: "Tân Châu, Tây Ninh", shelfLife: "24 tháng", storage: DRY, stock: 60, description: "Đường mía trắng tinh luyện, hạt đều." },
  { slug: "muoi-tom-tay-ninh", name: "Muối tôm Tây Ninh", category: "gia-vi", priceVnd: 35000, unit: "hũ 200g", netGrams: 200, isWeighed: false, origin: "Tây Ninh", shelfLife: "12 tháng", storage: DRY, stock: 40, description: "Muối tôm cay mặn, chấm trái cây xanh." },
  { slug: "toi-ly-son", name: "Tỏi Lý Sơn", category: "gia-vi", priceVnd: 45000, unit: "túi 200g", netGrams: 200, isWeighed: false, origin: "Lý Sơn, Quảng Ngãi", shelfLife: "3 tháng", storage: DRY, stock: 35, description: "Tỏi cô đơn Lý Sơn tép nhỏ, thơm cay đậm." },
  { slug: "ot-hiem", name: "Ớt hiểm", category: "gia-vi", priceVnd: 12000, unit: "túi 100g", netGrams: 100, isWeighed: false, origin: "Chợ Gạo, Tiền Giang", shelfLife: "7 ngày", storage: FRIDGE, stock: 50, description: "Ớt hiểm trái nhỏ, cay nồng, dùng làm nước chấm." },
];

export const giftBase: CatalogProduct = {
  slug: "gio-may-qua-bieu",
  name: "Giỏ mây quà biếu",
  category: "trai-cay",
  priceVnd: 120000,
  unit: "giỏ kèm nơ và thiệp",
  isWeighed: false,
  origin: "Phú Vinh, Hà Nội",
  shelfLife: "Không áp dụng",
  storage: DRY,
  stock: 20,
  description: "Giỏ mây đan tay kèm nơ, dùng để xếp giỏ quà biếu.",
  isGiftBase: true,
};
```

- [ ] **Step 3: Chạy test catalog**

Run: `npx vitest run prisma/catalog.test.ts`. Expected: PASS 6 tests.

- [ ] **Step 4: `prisma/seed.ts`**

```ts
import { existsSync, statSync } from "node:fs";
import path from "node:path";
import { db } from "~/lib/db.server";
import { env } from "~/lib/env.server";
import { toSearch } from "~/lib/format";
import { placeholderImage, saveSquareImage } from "~/lib/images.server";
import { type CatalogProduct, categories, giftBase, products } from "./catalog";

const SOURCE_DIR = "seed/images/products";
const OUT_DIR = path.join(env.UPLOAD_DIR, "products");

/** Xử lý lại khi chưa có output hoặc ảnh nguồn mới hơn output (thay placeholder bằng ảnh thật). */
async function ensureImage(p: CatalogProduct, color: string) {
  const src = path.join(SOURCE_DIR, `${p.slug}.jpg`);
  const out = path.join(OUT_DIR, `${p.slug}-640.webp`);
  const hasSrc = existsSync(src);
  const upToDate = existsSync(out) && (!hasSrc || statSync(out).mtimeMs >= statSync(src).mtimeMs);
  if (!upToDate) await saveSquareImage(hasSrc ? src : placeholderImage(p.name, color), OUT_DIR, p.slug);
  return `products/${p.slug}`;
}

const categoryIds = new Map<string, number>();
for (const c of categories) {
  const data = { name: c.name, sort: c.sort, image: `products/${c.cover}` };
  const row = await db.category.upsert({ where: { slug: c.slug }, update: data, create: { slug: c.slug, ...data } });
  categoryIds.set(c.slug, row.id);
}

const colorOf = new Map(categories.map((c) => [c.slug, c.color]));
for (const p of [...products, giftBase]) {
  const { category, ...fields } = p;
  const data = {
    ...fields,
    nameSearch: toSearch(p.name),
    categoryId: categoryIds.get(category)!,
    images: [await ensureImage(p, colorOf.get(category)!)],
    isGiftBase: p.isGiftBase ?? false,
  };
  await db.product.upsert({ where: { slug: p.slug }, update: data, create: data });
}

console.log(`Seed xong: ${categories.length} danh mục, ${products.length + 1} sản phẩm.`);
await db.$disconnect();
```

- [ ] **Step 5: Chạy seed lần 1 (chưa có ảnh nguồn nên dùng placeholder)**

Run: `npx prisma db seed`
Expected: `Seed xong: 6 danh mục, 41 sản phẩm.`; `ls uploads/products | wc -l` → `246` (41 × 6).

- [ ] **Step 6: Chạy seed lần 2, xác nhận idempotent (Review Focus 1)**

```bash
npx prisma db seed
docker compose exec -T db psql -U chosang -tAc 'SELECT count(*) FROM "Product"; SELECT count(*) FROM "Category";'
```

Expected: `41` và `6`.

- [ ] **Step 7: Checkpoint**: `npm run typecheck && npm test`.

---

### Task 6: Design tokens, font, layout, trang chủ tạm

**Files:**
- Modify: `app/app.css`, `app/root.tsx`, `app/routes/home.tsx`
- Create: `app/components/site-header.tsx`, `app/components/site-footer.tsx`

**Interfaces:**
- Consumes: `db`, `formatVnd`
- Produces: Tailwind utilities `bg-bg`, `bg-surface`, `text-ink`, `text-ink-muted`, `border-line`, `bg-brand`/`text-brand`, `bg-brand-press`, `text-fresh`, `bg-fresh-tint`, `bg-sun`, `text-danger`, `font-display`, `font-sans`, `ease-snappy`; `<SiteHeader />`, `<SiteFooter />`.

- [ ] **Step 1: `app/app.css`**

```css
@import "tailwindcss";
@import "@fontsource/be-vietnam-pro/latin-400.css";
@import "@fontsource/be-vietnam-pro/vietnamese-400.css";
@import "@fontsource/be-vietnam-pro/latin-600.css";
@import "@fontsource/be-vietnam-pro/vietnamese-600.css";
@import "@fontsource/bricolage-grotesque/latin-800.css";
@import "@fontsource/bricolage-grotesque/vietnamese-800.css";

@theme {
  --color-bg: #fafaf5;
  --color-surface: #ffffff;
  --color-ink: #2a1b3d;
  --color-ink-muted: #5e5470;
  --color-line: #e4dfea;
  --color-brand: #c8246b;
  --color-brand-press: #a61d58;
  --color-fresh: #2f7a34;
  --color-fresh-tint: #e8f3e6;
  --color-sun: #ffc83d;
  --color-danger: #b42318;

  --font-sans: "Be Vietnam Pro", ui-sans-serif, system-ui, sans-serif;
  --font-display: "Bricolage Grotesque", "Be Vietnam Pro", ui-sans-serif, sans-serif;

  --ease-snappy: cubic-bezier(0.2, 0.8, 0.2, 1);
}

@layer base {
  html {
    color-scheme: light;
  }
  body {
    @apply bg-bg font-sans text-ink antialiased;
    line-height: 1.5;
  }
  h1,
  h2,
  h3 {
    @apply font-display font-extrabold;
    line-height: 1.15; /* ≥1.1 để dấu chồng (ẫ, ặ, ộ) không bị cắt */
  }
  :focus-visible {
    outline: 2px solid var(--color-brand);
    outline-offset: 2px;
  }
}

@media (prefers-reduced-motion: reduce) {
  *,
  *::before,
  *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
    scroll-behavior: auto !important;
  }
}
```

- [ ] **Step 2: `app/components/site-header.tsx`**

Ô tìm kiếm dùng label `sr-only` kèm icon. Đây là ngoại lệ có chủ đích cho quy tắc "label luôn hiển thị", vì ô search là quy ước người dùng đã quen. `/collections/all` sẽ có ở M1; ở M0 submit ra 404 là đúng dự kiến.

```tsx
import { Search } from "lucide-react";
import { Form, Link } from "react-router";

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-30 border-b border-line bg-bg/95 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-2">
        <Link to="/" className="font-display text-2xl font-extrabold leading-tight text-brand">
          Chợ Sáng
        </Link>
        <Form method="get" action="/collections/all" role="search" className="relative flex-1">
          <label htmlFor="site-search" className="sr-only">
            Tìm sản phẩm
          </label>
          <Search
            aria-hidden
            className="pointer-events-none absolute top-1/2 left-3 size-5 -translate-y-1/2 text-ink-muted"
          />
          <input
            id="site-search"
            name="q"
            type="search"
            placeholder="Tìm rau, trứng, sữa…"
            autoComplete="off"
            enterKeyHint="search"
            className="h-11 w-full rounded-full border border-line bg-surface pr-4 pl-10 text-base placeholder:text-ink-muted"
          />
        </Form>
      </div>
    </header>
  );
}
```

- [ ] **Step 3: `app/components/site-footer.tsx`**

```tsx
export function SiteFooter() {
  return (
    <footer className="mt-16 border-t border-line">
      <div className="mx-auto max-w-6xl space-y-1 px-4 py-8 text-sm text-ink-muted">
        <p>Chợ Sáng · Bản demo, không giao hàng và không thu tiền thật.</p>
        <p>Ảnh sản phẩm là ảnh minh hoạ.</p>
      </div>
    </footer>
  );
}
```

- [ ] **Step 4: `app/root.tsx` (thay toàn bộ)**

Preload 2 file font body 400. Vite cấp cùng URL băm cho file mà CSS import, nên preload và `@font-face` trỏ cùng một file.

```tsx
import bodyLatin from "@fontsource/be-vietnam-pro/files/be-vietnam-pro-latin-400-normal.woff2?url";
import bodyVietnamese from "@fontsource/be-vietnam-pro/files/be-vietnam-pro-vietnamese-400-normal.woff2?url";
import { isRouteErrorResponse, Links, Meta, Outlet, Scripts, ScrollRestoration } from "react-router";
import type { Route } from "./+types/root";
import { SiteFooter } from "./components/site-footer";
import { SiteHeader } from "./components/site-header";
import "./app.css";

export const links: Route.LinksFunction = () =>
  [bodyLatin, bodyVietnamese].map((href) => ({
    rel: "preload",
    href,
    as: "font",
    type: "font/woff2",
    crossOrigin: "anonymous" as const,
  }));

export function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="vi">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="theme-color" content="#FAFAF5" />
        <Meta />
        <Links />
      </head>
      <body>
        <SiteHeader />
        {children}
        <SiteFooter />
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  );
}

export default function App() {
  return <Outlet />;
}

export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
  const notFound = isRouteErrorResponse(error) && error.status === 404;
  const detail = import.meta.env.DEV && error instanceof Error ? error.stack : undefined;
  return (
    <main className="mx-auto max-w-6xl px-4 py-16">
      <h1 className="text-3xl">{notFound ? "Không tìm thấy trang" : "Có lỗi xảy ra"}</h1>
      <p className="mt-2 text-ink-muted">
        {notFound ? "Trang bạn tìm không tồn tại hoặc đã được chuyển." : "Bạn thử tải lại trang giúp mình nhé."}
      </p>
      {detail && <pre className="mt-6 overflow-x-auto text-xs">{detail}</pre>}
    </main>
  );
}
```

- [ ] **Step 5: `app/routes/home.tsx` (trang tạm kiểm tra font + DB, M1 sẽ thay)**

```tsx
import { db } from "~/lib/db.server";
import { formatVnd } from "~/lib/format";
import type { Route } from "./+types/home";

export const meta: Route.MetaFunction = () => [
  { title: "Chợ Sáng: đi chợ sáng trong 3 phút" },
  { name: "description", content: "Rau củ, trái cây, thịt cá, trứng sữa giao trong ngày." },
];

export async function loader() {
  const count = await db.product.count({ where: { isActive: true, isGiftBase: false } });
  return { count };
}

export default function Home({ loaderData }: Route.ComponentProps) {
  return (
    <main className="mx-auto max-w-6xl space-y-4 px-4 py-10">
      <h1 className="text-4xl">Bưởi Diễn, Rau muống, Sữa tươi</h1>
      <p className="text-lg">
        Đang có <strong className="font-semibold">{loaderData.count}</strong> sản phẩm. Ẩm thực Việt: ẫ ặ ộ ữ ỡ ự.
      </p>
      <p className="font-display text-3xl font-extrabold text-brand tabular-nums">{formatVnd(312000)}</p>
    </main>
  );
}
```

- [ ] **Step 6: Kiểm tra build + preload khớp file CSS**

```bash
npm run typecheck
npm run build
ls build/client/assets | grep -E 'be-vietnam-pro-(latin|vietnamese)-400'
grep -o 'be-vietnam-pro-vietnamese-400-normal-[A-Za-z0-9_-]*\.woff2' build/client/assets/*.css | head -1
```

Expected: mỗi file font 400 xuất hiện **đúng một lần** trong `assets` (preload và CSS dùng chung một file).

- [ ] **Step 7: Kiểm tra trực quan (skill `playwright-cli` hoặc `ui-check`)**

`npm run dev`, mở `http://localhost:5173/` ở viewport **375×812** và 1280×800, chụp màn hình. Kiểm tra:
- Dấu của "Bưởi Diễn, Rau muống, Sữa tươi" ở weight 800 **không bị cắt** phía trên.
- Header dính khi cuộn, ô tìm kiếm cao 44px, focus ring màu magenta khi bấm Tab.
- Console: `document.fonts.check('800 16px "Bricolage Grotesque"') && document.fonts.check('400 16px "Be Vietnam Pro"')` trả `true`.
- Trang chủ hiện "Đang có 40 sản phẩm" và giá `312.000₫`.

- [ ] **Step 8: Checkpoint**: `npm run typecheck && npm test`.

---

### Task 7: Tuyển ảnh minh hoạ (Unsplash/Pexels)

Task này **không chặn** Task 8; chạy song song được. Ảnh là dữ liệu tải từ ngoài, chỉ được đưa qua sharp, không bao giờ thực thi.

**Files:**
- Create: `seed/images/products/<slug>.jpg` × 41, `seed/images/CREDITS.md`

**Interfaces:**
- Consumes: slug trong `prisma/catalog.ts`
- Produces: ảnh nguồn mà `prisma/seed.ts` tự nhận (so mtime)

- [ ] **Step 1: Quy tắc chọn ảnh** (spec mục 4 + 9)
  - Nguồn: chỉ Unsplash hoặc Pexels (license cho phép dùng miễn phí). **Mỗi danh mục lấy ảnh cùng một phong cách**: nền sáng/trơn, sản phẩm ở giữa, ánh sáng tự nhiên.
  - Không có người, chữ, logo thương hiệu hay watermark. Cạnh ngắn ≥ 1000px.
  - Ảnh phải đúng sản phẩm (rau muống chứ không phải rau bất kỳ). Không có ảnh đúng thì để trống: seed giữ placeholder, ghi vào CREDITS là `placeholder`.

- [ ] **Step 2: Tải ảnh**

Với mỗi slug, tìm ảnh, tải bản JPG (Unsplash: `https://images.unsplash.com/photo-<id>?w=1600&q=80&fm=jpg`) về `seed/images/products/<slug>.jpg`.

- [ ] **Step 3: `seed/images/CREDITS.md`**

```markdown
# Nguồn ảnh minh hoạ

| slug | Tác giả | URL trang ảnh | License |
|---|---|---|---|
| rau-muong | <tên tác giả> | https://unsplash.com/photos/<id> | Unsplash License |
```

Mỗi slug một dòng (41 dòng). Slug không có ảnh ghi `placeholder`.

- [ ] **Step 4: Kiểm tra + seed lại (Review Focus 5)**

```bash
node -e "
const fs=require('fs'),sharp=require('sharp');
const files=fs.readdirSync('seed/images/products').filter(f=>f.endsWith('.jpg'));
Promise.all(files.map(f=>sharp('seed/images/products/'+f).metadata().then(m=>[f,Math.min(m.width,m.height)])))
 .then(r=>{const bad=r.filter(([,s])=>s<1000);console.log(files.length,'ảnh; quá nhỏ:',bad)})"
npx prisma db seed
find uploads/products -name 'rau-muong-640.webp' -newer seed/images/products/rau-muong.jpg
```

Expected: không có ảnh "quá nhỏ"; lệnh `find` in ra đường dẫn (output mới hơn nguồn, tức ảnh thật đã thay placeholder).

- [ ] **Step 5: Checkpoint**: `npm test`.

---

### Task 8: Rà soát cuối M0 (Definition of Done)

**Files:** không tạo mới.

- [ ] **Step 1: Chạy lại từ đầu như máy mới**

```bash
docker compose down -v
rm -rf uploads app/generated
docker compose up -d --wait db
npm run setup
npm run dev -- --port 5173 &
sleep 5 && curl -s localhost:5173/ | grep -o 'Đang có <strong[^>]*>40'
kill %1
```

Expected: `npm run setup` chạy hết migrate + generate + seed không lỗi; curl tìm thấy chuỗi số 40.

- [ ] **Step 2: Typecheck + test**

Run: `npm run typecheck && npm test`
Expected: typecheck sạch; mọi test pass (format 6, env 2, db 1, images 2, catalog 6).

- [ ] **Step 3: Kiểm tra ràng buộc toàn cục**

```bash
grep -rn "@remix-run" app prisma && echo "VI PHẠM" || echo "ok: không có @remix-run"
node -e "const p=require('./package.json');const all={...p.dependencies,...p.devDependencies};const loose=Object.entries(all).filter(([,v])=>/[\^~]/.test(v));console.log(loose.length?['CHƯA GHIM',loose]:'ok: mọi phiên bản đã ghim')"
du -cb node_modules/@fontsource/be-vietnam-pro/files/be-vietnam-pro-{latin,vietnamese}-{400,600}-normal.woff2 node_modules/@fontsource/bricolage-grotesque/files/bricolage-grotesque-{latin,vietnamese}-800-normal.woff2 | tail -1
```

Expected: `ok` ở 2 dòng đầu; tổng font ≤ 102400 bytes (đo được 93812).

- [ ] **Step 4: Review**
  - Developer review: `superpowers:requesting-code-review` (+ `ponytail:ponytail-review`).
  - Designer: tokens + font ở Task 6 Step 7, chạy skill `ui-check`.
  - Consultant: đối chiếu phiên bản và kiến trúc với spec mục 5.

- [ ] **Step 5: Bàn giao sang M1**: viết `docs/superpowers/plans/<ngày>-m1-catalog.md` bằng `superpowers:writing-plans`, dùng hợp đồng module ở roadmap.
