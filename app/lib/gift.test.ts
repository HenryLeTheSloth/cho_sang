import { expect, test } from "vitest";
import { countItems, isPreview, previewUrl } from "~/lib/gift";

test("isPreview: chỉ data URL webp/jpeg base64, tối đa 60KB", () => {
  expect(isPreview("data:image/webp;base64,UklGRg==")).toBe(true);
  expect(isPreview("data:image/jpeg;base64,/9j/4AAQ")).toBe(true);
  for (const bad of [
    "data:image/png;base64,iVBORw0KGgo=", // PNG (Safari khi không mã hoá được webp) phải được client đổi sang jpeg
    "data:image/svg+xml;base64,PHN2Zz4=",
    "data:text/html;base64,PGgxPg==",
    "https://evil.test/a.webp",
    "data:image/webp;base64,UklGRg==\"><script>",
    `data:image/webp;base64,${"A".repeat(60 * 1024)}`, // quá 60KB
    42,
    null,
  ]) {
    expect(isPreview(bad)).toBe(false);
  }
});

test("countItems: danh sách món suy ra từ layout bằng cách đếm pid", () => {
  const at = { x: 0.5, y: 0.5, s: 1, r: 0 };
  expect([...countItems([{ pid: 3, ...at }, { pid: 7, ...at }, { pid: 3, ...at }])]).toEqual([[3, 2], [7, 1]]);
  expect(countItems([]).size).toBe(0);
});

test("previewUrl", () => {
  expect(previewUrl("cmgr0x9k10000abcd1234efgh")).toBe("/gift/preview/cmgr0x9k10000abcd1234efgh");
});
