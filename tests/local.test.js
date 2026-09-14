import test from "node:test";
import assert from "node:assert/strict";
import "fake-indexeddb/auto";
import { repository } from "../src/repository.js";
import { calculate } from "../shared/finance.js";
test("IndexedDB persistence, atomic numbering, payment limits and seed-once", async () => {
  await repository.init();
  const data = await repository.all();
  assert.equal(data.invoices.length, 24);
  await repository.init();
  assert.equal((await repository.all()).invoices.length, 24);
  const base = {
    ...data.invoices[0],
    id: undefined,
    state: "draft",
    items: Array.from({ length: 5 }, () => ({
      id: crypto.randomUUID(),
      description: "Adeeg",
      quantity: 2,
      price: 100,
    })),
    discount: 10,
    tax: 5,
  };
  const invoices = await Promise.all(
    Array.from({ length: 10 }, () => repository.saveInvoice(base)),
  );
  assert.equal(new Set(invoices.map((i) => i.number)).size, 10);
  const i = invoices[0];
  assert.equal(i.total, 94500);
  assert.equal(i.tax, 5);
  assert.equal(i.discount, 10);
  assert.equal(calculate(i).total, 94500);
  await repository.pay(i.id, 40000, "EVC Plus", "test");
  let stored = (await repository.all()).invoices.find((x) => x.id === i.id);
  assert.equal(stored.status, "partial");
  assert.equal(stored.paid, 40000);
  await assert.rejects(repository.pay(i.id, 54501, "Cash", ""));
  await assert.rejects(
    repository.saveInvoice({
      ...stored,
      items: [
        { id: crypto.randomUUID(), description: "Low", quantity: 1, price: 1 },
      ],
    }),
  );
  await assert.rejects(
    repository.saveInvoice({ ...i, notes: "Stale edit" }),
    /meel kale/,
  );
  await repository.pay(i.id, 54500, "ZAAD", "");
  stored = (await repository.all()).invoices.find((x) => x.id === i.id);
  assert.equal(stored.status, "paid");
  await assert.rejects(repository.pay(i.id, 1, "Cash", ""));
  await repository.removeInvoice(i.id);
  const after = await repository.all();
  assert.ok(!after.invoices.some((x) => x.id === i.id));
  assert.ok(!after.payments.some((p) => p.invoiceId === i.id));
  await assert.rejects(
    repository.saveInvoice({
      ...base,
      items: [{ description: "invalid", quantity: -1, price: 10 }],
    }),
  );
});
