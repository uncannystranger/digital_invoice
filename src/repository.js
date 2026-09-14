import { calculate, statusOf, today } from "../shared/finance.js";
const stores = ["settings", "customers", "invoices", "payments", "meta"];
let connection;
const channel =
  typeof window !== "undefined" && "BroadcastChannel" in window
    ? new BroadcastChannel("qaansheeg-data")
    : null;
const request = (r) =>
  new Promise((resolve, reject) => {
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  });
async function db() {
  if (!connection)
    connection = new Promise((resolve, reject) => {
      const r = indexedDB.open("qaansheeg-local", 1);
      r.onupgradeneeded = () =>
        stores.forEach((s) => r.result.createObjectStore(s, { keyPath: "id" }));
      r.onsuccess = () => resolve(r.result);
      r.onerror = () => reject(r.error);
    });
  return connection;
}
async function transaction(names, fn) {
  const d = await db();
  return new Promise((resolve, reject) => {
    const tx = d.transaction(names, "readwrite");
    let result;
    tx.oncomplete = () => {
      channel?.postMessage("changed");
      resolve(result);
    };
    tx.onerror = () => reject(tx.error);
    tx.onabort = () =>
      reject(tx.error || new Error("Kaydinta way fashilantay."));
    Promise.resolve(fn(tx))
      .then((v) => (result = v))
      .catch((e) => {
        reject(e);
        tx.abort();
      });
  });
}
export const defaults = {
  id: "business",
  name: "Hilaac Studio",
  phone: "+252 61 000 0000",
  email: "hello@example.test",
  address: "Muqdisho, Soomaaliya",
  city: "Muqdisho",
  country: "Soomaaliya",
  logo: "",
  accent: "#086b8a",
  prefix: "QSH",
  currency: "USD",
  tax: 5,
  dueDays: 7,
  notes: "",
  terms: "",
  footer: "Waad ku mahadsan tahay wada shaqaynta.",
  signature: "",
  methods: ["EVC Plus", "ZAAD", "eDahab", "Sahal", "Bangiga", "Cash"].map(
    (name, n) => ({
      name,
      enabled: n < 2,
      details: n === 0 ? "+252 61 000 0000" : n === 1 ? "+252 63 000 0000" : "",
    }),
  ),
};
export const repository = {
  subscribe(listener) {
    channel?.addEventListener("message", listener);
    return () => channel?.removeEventListener("message", listener);
  },
  async init() {
    await transaction(stores, async (tx) => {
      if (await request(tx.objectStore("meta").get("seed"))) return;
      tx.objectStore("settings").put(defaults);
      const names = [
        "Hilaac Technology",
        "Dahabshiil",
        "Bilan Creative",
        "Somtel",
        "Dalmar Trading",
        "Sahan Logistics",
        "Himilo Consulting",
        "Hormuud Telecom",
        "Premier Bank",
        "Salaam Somali Bank",
      ];
      const customers = names.map((name, n) => ({
        id: crypto.randomUUID(),
        name,
        contact: ["Mohamed Hassan", "Ayaan Cabdi", "Fadumo Ali"][n % 3],
        phone: "+252 61 000 " + String(n).padStart(4, "0"),
        email: "info" + n + "@example.test",
        address: "Muqdisho, Soomaaliya",
        sample: true,
      }));
      customers.forEach((c) => tx.objectStore("customers").put(c));
      for (let n = 0; n < 24; n++) {
        const c = customers[n % 10],
          amount = [1250, 850, 2400, 430, 650, 1800][n % 6];
        const i = {
          id: crypto.randomUUID(),
          number: `QSH-2026-${String(24 - n).padStart(4, "0")}`,
          customerId: c.id,
          customerSnapshot: c,
          businessSnapshot: defaults,
          issue:
            "2026-09-" +
            String(n < 4 ? [12, 10, 8, 3][n] : 12 - (n % 10)).padStart(2, "0"),
          due: n % 8 === 3 ? "2026-09-13" : "2026-09-30",
          currency: "USD",
          state: n === 23 ? "draft" : "sent",
          items: [
            {
              id: crypto.randomUUID(),
              description: [
                "Naqshadeynta Website-ka",
                "Adeegga la-talinta",
                "Naqshad iyo daabacaad",
              ][n % 3],
              quantity: 1,
              price: amount,
            },
          ],
          discount: 0,
          discountType: "percent",
          tax: 0,
          taxType: "percent",
          notes: "",
          terms: "",
          paymentMethods: ["EVC Plus", "ZAAD"],
          sample: true,
        };
        i.total = calculate(i).total;
        tx.objectStore("invoices").put(i);
        if (n % 8 < 5 && n % 8 !== 1 && n % 8 !== 3)
          tx.objectStore("payments").put({
            id: crypto.randomUUID(),
            invoiceId: i.id,
            amount: n === 2 ? 120000 : i.total,
            method: "EVC Plus",
            date: today(),
            reference: "Tusaale",
          });
      }
      tx.objectStore("meta").put({ id: "number", value: 24 });
      tx.objectStore("meta").put({
        id: "session",
        name: "Isticmaale",
        language: "so",
      });
      tx.objectStore("meta").put({ id: "seed", version: 1 });
    });
  },
  async all() {
    const d = await db();
    const tx = d.transaction(stores);
    const [settings, customers, invoices, payments] = await Promise.all(
      ["settings", "customers", "invoices", "payments"].map((s) =>
        request(tx.objectStore(s).getAll()),
      ),
    );
    return {
      settings: settings[0],
      customers,
      invoices: invoices
        .map((i) => {
          const paid = payments
            .filter((p) => p.invoiceId === i.id)
            .reduce((a, p) => a + p.amount, 0);
          return { ...i, paid, status: statusOf(i, paid) };
        })
        .sort((a, b) =>
          b.number.localeCompare(a.number, undefined, { numeric: true }),
        ),
      payments,
    };
  },
  async put(store, value) {
    return transaction([store], (tx) => {
      tx.objectStore(store).put(value);
      return value;
    });
  },
  async saveInvoice(value) {
    return transaction(["invoices", "meta", "payments"], async (tx) => {
      if (
        !value.customerId ||
        !value.items?.length ||
        value.items.some(
          (item) =>
            !item.description?.trim() ||
            !Number.isFinite(Number(item.quantity)) ||
            Number(item.quantity) <= 0 ||
            !Number.isFinite(Number(item.price)) ||
            Number(item.price) < 0,
        ) ||
        Number(value.tax) < 0 ||
        Number(value.tax) > 100 ||
        Number(value.discount) < 0 ||
        Number(value.discount) > 100 ||
        !value.issue ||
        !value.due ||
        value.due < value.issue
      )
        throw new Error("Hubi xogta qaansheegga.");
      const invoice = { ...value, total: calculate(value).total };
      const old = value.id
        ? await request(tx.objectStore("invoices").get(value.id))
        : null;
      if (old) {
        if ((value.version || 0) !== (old.version || 0))
          throw new Error(
            "Qaansheeggan meel kale ayaa laga beddelay. Dib u fur ka hor intaadan kaydin.",
          );
        const payments = await request(tx.objectStore("payments").getAll());
        if (
          payments
            .filter((p) => p.invoiceId === value.id)
            .reduce((a, p) => a + p.amount, 0) > invoice.total
        )
          throw new Error("Wadartu kama yaraan karto lacagta la bixiyey.");
        invoice.number = old.number;
      } else {
        const n = await request(tx.objectStore("meta").get("number"));
        n.value++;
        invoice.id = crypto.randomUUID();
        invoice.number = `${value.businessSnapshot.prefix}-${new Date().getFullYear()}-${String(n.value).padStart(4, "0")}`;
        tx.objectStore("meta").put(n);
      }
      invoice.version = (old?.version || 0) + 1;
      delete invoice.paid;
      delete invoice.status;
      tx.objectStore("invoices").put(invoice);
      return invoice;
    });
  },
  async removeInvoice(id) {
    return transaction(["invoices", "payments"], async (tx) => {
      tx.objectStore("invoices").delete(id);
      const p = await request(tx.objectStore("payments").getAll());
      p.filter((x) => x.invoiceId === id).forEach((x) =>
        tx.objectStore("payments").delete(x.id),
      );
    });
  },
  async pay(id, amount, method, reference) {
    return transaction(["invoices", "payments"], async (tx) => {
      const i = await request(tx.objectStore("invoices").get(id));
      const p = await request(tx.objectStore("payments").getAll());
      const paid = p
        .filter((x) => x.invoiceId === id)
        .reduce((a, x) => a + x.amount, 0);
      if (
        !Number.isSafeInteger(amount) ||
        amount <= 0 ||
        amount > i.total - paid
      )
        throw new Error("Hubi lacagta; kama badnaan karto hadhaaga.");
      tx.objectStore("payments").put({
        id: crypto.randomUUID(),
        invoiceId: id,
        amount,
        method,
        reference,
        date: today(),
      });
      i.state = "sent";
      i.version = (i.version || 0) + 1;
      tx.objectStore("invoices").put(i);
    });
  },
};
