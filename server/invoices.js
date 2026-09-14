import { randomUUID, randomBytes, createHash } from "node:crypto";
import { one, all, run, defaultSettings } from "./db.js";
import { calculate, statusOf, today } from "../shared/finance.js";
export const id = () => randomUUID();
export const hash = (s) => createHash("sha256").update(s).digest("hex");
export const now = () => new Date().toISOString();
export function fail(message, status = 400) {
  const e = new Error(message);
  e.status = status;
  throw e;
}
export function settings(b) {
  const row = one("SELECT * FROM business_settings WHERE business_id=?", b);
  return { ...JSON.parse(row.data), nextSequence: row.next_sequence };
}
export function log(b, invoice, actor, action) {
  run(
    "INSERT INTO activity_logs VALUES(?,?,?,?,?,?)",
    id(),
    b,
    invoice,
    actor,
    action,
    now(),
  );
}
export function customer(b, c) {
  const r = one("SELECT * FROM customers WHERE id=? AND business_id=?", c, b);
  if (!r) fail("Macmiilka lama helin.", 404);
  return {
    id: r.id,
    ...JSON.parse(r.data),
    archived: !!r.archived,
    sample: !!r.sample,
  };
}
export function listInvoices(b) {
  return all(
    "SELECT * FROM invoices WHERE business_id=? AND deleted=0 ORDER BY created_at DESC",
    b,
  ).map((r) => hydrate(r));
}
export function hydrate(r) {
  const payments = all(
    "SELECT * FROM payments WHERE invoice_id=? AND business_id=? ORDER BY date DESC,created_at DESC",
    r.id,
    r.business_id,
  ).map(({ business_id, idempotency_key, ...p }) => p);
  const paid = payments.reduce((s, p) => s + p.amount, 0);
  const d = JSON.parse(r.data);
  return {
    ...d,
    id: r.id,
    customerId: r.customer_id,
    number: r.number,
    issue: r.issue,
    due: r.due,
    currency: r.currency,
    state: r.state,
    version: r.version,
    sample: !!r.sample,
    items: all(
      "SELECT description,quantity,price,id FROM invoice_items WHERE invoice_id=? ORDER BY position",
      r.id,
    ),
    total: r.total,
    paid,
    balance: r.total - paid,
    status: statusOf(r, paid),
    payments,
    createdAt: r.created_at,
  };
}
export function invoice(b, key) {
  const row = one(
    "SELECT * FROM invoices WHERE id=? AND business_id=? AND deleted=0",
    key,
    b,
  );
  if (!row) fail("Qaansheegga lama helin.", 404);
  return hydrate(row);
}
export function makeInvoice(b, data, actor, sample = false) {
  if (data.requestKey) {
    const previous = one(
      "SELECT invoice_id FROM invoice_requests WHERE business_id=? AND request_key=?",
      b,
      data.requestKey,
    );
    if (previous) return invoice(b, previous.invoice_id);
  }
  const c = customer(b, data.customerId);
  if (c.archived) fail("Macmiilkan waa la kaydiyey. Marka hore soo celi.");
  const s = settings(b);
  const totals = calculate(data);
  let sequence = s.nextSequence;
  let number;
  do {
    number = `${s.prefix}-${new Date().getUTCFullYear()}-${String(sequence++).padStart(4, "0")}`;
  } while (
    one("SELECT id FROM invoices WHERE business_id=? AND number=?", b, number)
  );
  run(
    "UPDATE business_settings SET next_sequence=? WHERE business_id=?",
    sequence,
    b,
  );
  const key = id();
  const snapshot = {
    ...data,
    customerSnapshot: c,
    businessSnapshot: s,
    totals,
  };
  delete snapshot.items;
  delete snapshot.version;
  run(
    "INSERT INTO invoices(id,business_id,customer_id,number,issue,due,currency,state,total,data,sample,created_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)",
    key,
    b,
    c.id,
    number,
    data.issue,
    data.due,
    data.currency,
    "draft",
    totals.total,
    JSON.stringify(snapshot),
    sample ? 1 : 0,
    now(),
  );
  replaceItems(key, data.items);
  if (data.requestKey)
    run("INSERT INTO invoice_requests VALUES(?,?,?)", b, data.requestKey, key);
  log(b, key, actor, "Qaansheeg la sameeyay");
  return invoice(b, key);
}
export function replaceItems(key, items) {
  run("DELETE FROM invoice_items WHERE invoice_id=?", key);
  items.forEach((i, n) =>
    run(
      "INSERT INTO invoice_items VALUES(?,?,?,?,?,?)",
      id(),
      key,
      n,
      i.description,
      String(i.quantity),
      String(i.price),
    ),
  );
}
export function editInvoice(b, key, data, actor) {
  const old = invoice(b, key);
  if (old.state !== "draft")
    fail(
      "Qaansheeg la diray ama la kansalay lama beddeli karo. Nuqul cusub samee.",
      409,
    );
  if (data.version !== old.version)
    fail(
      "Qof kale ayaa beddelay qaansheeggan. Dib u fur ka hor kaydinta.",
      409,
    );
  const c = customer(b, data.customerId);
  if (c.archived) fail("Macmiilkan waa la kaydiyey.");
  const totals = calculate(data);
  const snapshot = {
    ...data,
    customerSnapshot: c,
    businessSnapshot: settings(b),
    totals,
  };
  delete snapshot.items;
  delete snapshot.version;
  run(
    "UPDATE invoices SET customer_id=?,issue=?,due=?,currency=?,total=?,data=?,version=version+1 WHERE id=? AND business_id=?",
    c.id,
    data.issue,
    data.due,
    data.currency,
    totals.total,
    JSON.stringify(snapshot),
    key,
    b,
  );
  replaceItems(key, data.items);
  log(b, key, actor, "Qaansheeg wax laga beddelay");
  return invoice(b, key);
}
export function createLink(b, key, actor, origin) {
  const inv = invoice(b, key);
  if (inv.state === "cancelled") fail("Qaansheeggan waa la kansalay.");
  const token = randomBytes(32).toString("base64url");
  run(
    "INSERT INTO public_links VALUES(?,?,?,?,0)",
    hash(token),
    b,
    key,
    Date.now() + 90 * 86400000,
  );
  run(
    "UPDATE invoices SET state='sent',version=version+1 WHERE id=? AND business_id=?",
    key,
    b,
  );
  log(b, key, actor, "Xiriir wadaagis la sameeyay");
  return { url: `${origin}/q/${token}` };
}
export function seed(b, actor) {
  if (one("SELECT id FROM customers WHERE business_id=? LIMIT 1", b))
    fail("Xogta tusaalaha ah waxaa lagu dari karaa ganacsi madhan oo keliya.");
  const names = [
    "Hormuud Telecom",
    "Premier Bank",
    "Dahabshiil",
    "Hilaac Technology",
    "Bilan Creative Agency",
    "Dayax Construction",
    "Sahan Logistics",
    "Himilo Consulting",
    "Dalmar Trading",
    "Somtel",
  ];
  const people = [
    "Ayaan Cabdi",
    "Mohamed Hassan",
    "Fadumo Ali",
    "Abdirahman Yusuf",
    "Hodan Ahmed",
  ];
  const cities = ["Muqdisho", "Hargeysa", "Garoowe", "Boosaaso", "Kismaayo"];
  const cs = names.map((name, n) => {
    const key = id();
    run(
      "INSERT INTO customers VALUES(?,?,?,0,1)",
      key,
      b,
      JSON.stringify({
        name,
        contact: people[n % 5],
        phone: "",
        email: "",
        address: "Xog tusaale ah",
        city: cities[n % 5],
        notes:
          "Tusaale keliya; ma jiro xiriir ganacsi ama taageero la sheeganayo.",
      }),
    );
    return key;
  });
  const products = [
    ["Naqshadaynta summadda", "service", "250"],
    ["Samaynta mareegta", "service", "680"],
    ["La-talin ganacsi", "service", "150"],
    ["Qalabka xafiiska", "product", "35"],
  ];
  products.forEach(([name, type, price]) =>
    run(
      "INSERT INTO products VALUES(?,?,?,1)",
      id(),
      b,
      JSON.stringify({ name, description: name, type, price, currency: "USD" }),
    ),
  );
  const amounts = [1250, 680, 950, 420];
  cs.slice(0, 4).forEach((c, n) => {
    const issue = new Date(Date.now() - (n + 3) * 86400000)
      .toISOString()
      .slice(0, 10);
    const due =
      n === 3
        ? new Date(Date.now() - 86400000).toISOString().slice(0, 10)
        : new Date(Date.now() + 10 * 86400000).toISOString().slice(0, 10);
    const inv = makeInvoice(
      b,
      {
        customerId: c,
        issue,
        due,
        currency: "USD",
        discountType: "percent",
        discount: "0",
        taxType: "percent",
        tax: "0",
        notes: "Xog tusaale ah oo loogu talagalay bandhigga.",
        terms: "Fadlan bixi lacagta waqtigeeda.",
        signature: "",
        paymentMethods: ["Cash"],
        items: [
          {
            description: n === 3 ? "Taageero farsamo" : "Adeegyo ganacsi",
            quantity: "1",
            price: String(amounts[n]),
          },
        ],
      },
      actor,
      true,
    );
    run("UPDATE invoices SET state='sent' WHERE id=?", inv.id);
    if (n === 0 || n === 2) {
      const amount = n === 0 ? 125000 : 40000;
      run(
        "INSERT INTO payments VALUES(?,?,?,?,?,?,?,?,?,?)",
        id(),
        b,
        inv.id,
        amount,
        today(),
        "Cash",
        "TUSAALE",
        "Lacag-bixin tusaale ah",
        id(),
        now(),
      );
      log(b, inv.id, actor, "Lacag-bixin tusaale ah la diiwaangeliyey");
    }
  });
  log(b, null, actor, "Xogta tusaalaha ah lagu daray");
}
