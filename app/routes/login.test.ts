import { afterAll, expect, test } from "vitest";
import { db } from "~/lib/db.server";
import { commitSession, sessionStorage } from "~/lib/session.server";
import { loader } from "~/routes/login";

afterAll(() => db.$disconnect());

const call = async (userId: number) => {
  const s = await sessionStorage.getSession();
  s.set("userId", userId);
  const cookie = (await commitSession(s)).split(";")[0];
  try {
    return await loader({ request: new Request("http://localhost/login", { headers: { Cookie: cookie } }), params: {}, context: {} } as never);
  } catch (e) {
    return e as Response;
  }
};

test("userId trỏ tới tài khoản đã bị xoá: vẫn vào được form đăng nhập và cookie được xoá userId", async () => {
  const result = (await call(999_999_999)) as { data: { step: string }; init: { headers: Record<string, string> } };
  expect(result.data.step).toBe("phone"); // không redirect
  const header = result.init.headers["Set-Cookie"];
  const cleared = await sessionStorage.getSession(header.split(";")[0]);
  expect(cleared.get("userId")).toBeUndefined();
});

test("userId còn tài khoản thật: redirect như cũ", async () => {
  const user = await db.user.findFirstOrThrow({ where: { role: "customer" } }).catch(() => db.user.findFirstOrThrow());
  const res = (await call(user.id)) as Response;
  expect(res.status).toBe(302);
});
