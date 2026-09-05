import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
const page = await readFile(
  new URL("../dist/page.js", import.meta.url),
  "utf8",
);
const components = await readFile(
  new URL("../dist/components.js", import.meta.url),
  "utf8",
);
test("public experience includes real catalog, navigation and responsive UI", () => {
  assert.match(page, /api\/v1\/public\/catalog/);
  assert.match(page, /DỊCH VỤ CỦA CHÚNG TÔI/);
  assert.match(page, /3 bước/);
  assert.match(page, /CÂU HỎI THƯỜNG GẶP/);
  assert.match(components, /Public|header/i);
});
test("auth routes provide validation, password visibility and safe session fetch", () => {
  for (const route of [
    "login",
    "register",
    "forgot-password",
    "reset-password",
  ])
    assert.match(page, new RegExp(route));
  assert.match(page, /credentials:'include'/);
  assert.match(page, /checkValidity/);
  assert.match(page, /Hiện mật khẩu/);
  assert.doesNotMatch(page, /localStorage/);
});
test("operational errors are mapped to Vietnamese messages", () => {
  assert.match(page, /Email hoặc mật khẩu không đúng/);
  assert.doesNotMatch(page, /Failed to fetch/);
});
