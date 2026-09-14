import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { authAdapter, safeReturnTo, SESSION_KEY } from "../src/auth.js";
const store = new Map();
global.localStorage = {
  setItem: (k, v) => store.set(k, v),
  getItem: (k) => store.get(k) ?? null,
  removeItem: (k) => store.delete(k),
};
const setup = fs.readFileSync("DEVELOPMENT-README.md", "utf8");
const email = setup.match(/Email:\n([^\n]+)/)[1],
  password = setup.match(/Password:\n([^\n]+)/)[1];
test("Local auth hashing, persistence, expiry, logout isolation and redirect validation", async () => {
  assert.equal(await authAdapter.restoreSession(), null);
  assert.equal(await authAdapter.login(email, "wrong"), null);
  assert.equal(await authAdapter.login("other@example.test", password), null);
  assert.equal(email, "admin@gmail.com");
  assert.equal(password, "admin123");
  const user = await authAdapter.login(email.toUpperCase(), password);
  assert.equal(user.email, email);
  assert.equal((await authAdapter.restoreSession()).sessionId, user.sessionId);
  assert.equal(
    [...store.values()].some((v) => v.includes(password)),
    false,
  );
  assert.deepEqual(
    Object.keys(JSON.parse(store.get("qaansheeg-account"))).sort(),
    ["createdAt", "email", "passwordHash", "role"],
  );
  store.set("business-data", "preserved");
  await authAdapter.logout();
  assert.equal(store.get("business-data"), "preserved");
  assert.equal(await authAdapter.restoreSession(), null);
  store.set(SESSION_KEY, "broken");
  assert.equal(await authAdapter.restoreSession(), null);
  store.set(
    SESSION_KEY,
    JSON.stringify({ ...user, expiresAt: Date.now() - 1 }),
  );
  assert.equal(await authAdapter.restoreSession(), null);
  for (const value of [
    "//evil.test",
    "https://evil.test",
    "/login",
    "/qaansheegyo\\evil",
    "/dejintax",
  ])
    assert.equal(safeReturnTo(value), "/qaansheegyo");
  assert.equal(safeReturnTo("/qaansheegyo/abc?x=1"), "/qaansheegyo/abc?x=1");
});
