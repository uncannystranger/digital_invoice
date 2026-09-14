import test from "node:test";
import assert from "node:assert/strict";
import "fake-indexeddb/auto";
import { repository, validateBackup } from "../src/repository.js";

test("versioned backup exports only application data and validates references", async () => {
  await repository.init();
  const backup = await repository.backup();
  assert.equal(backup.app, "Digital Invoice");
  assert.equal(backup.version, 1);
  assert.ok(backup.invoices.length > 0);
  assert.equal(backup.invoices.some((i) => i.customerId), true);
  assert.throws(() => validateBackup({ ...backup, app: "Other" }), /ma saxna/);
  assert.throws(() => validateBackup({ ...backup, payments: [{ id: "bad", invoiceId: "missing", amount: 1 }] }), /Lacag-bixin/);
});
