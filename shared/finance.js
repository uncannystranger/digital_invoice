import Decimal from "decimal.js";
Decimal.set({ precision: 28, rounding: Decimal.ROUND_HALF_UP });
export const currencies = ["USD", "SOS"];
export const today = () => new Date().toISOString().slice(0, 10);
export function calculate(invoice) {
  const lines = invoice.items.map((i) =>
    new Decimal(i.quantity || 0)
      .mul(i.price || 0)
      .mul(100)
      .toDecimalPlaces(0)
      .toNumber(),
  );
  const subtotal = lines.reduce((a, b) => a + b, 0);
  const discount =
    invoice.discountType === "fixed"
      ? new Decimal(invoice.discount || 0).mul(100).round()
      : new Decimal(subtotal)
          .mul(invoice.discount || 0)
          .div(100)
          .round();
  if (discount.gt(subtotal))
    throw new Error("Dhimistu kama badnaan karto wadarta hoose.");
  const base = new Decimal(subtotal).minus(discount);
  const tax =
    invoice.taxType === "fixed"
      ? new Decimal(invoice.tax || 0).mul(100).round()
      : base
          .mul(invoice.tax || 0)
          .div(100)
          .round();
  const total = base.plus(tax).toNumber();
  if (!Number.isSafeInteger(total) || total > 1e13)
    throw new Error("Qiimaha ayaa aad u weyn.");
  return {
    lines,
    subtotal,
    discount: discount.toNumber(),
    tax: tax.toNumber(),
    total,
  };
}
export function statusOf(i, paid = 0) {
  if (i.state === "cancelled") return "cancelled";
  if (i.state === "draft") return "draft";
  if (paid >= i.total) return "paid";
  if (paid > 0) return "partial";
  if (i.due < today()) return "overdue";
  return "sent";
}
export function formatMoney(cents = 0, currency = "USD") {
  return currency === "SOS"
    ? `${new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }).format(cents / 100)} SOS`
    : new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: "USD",
      }).format(cents / 100);
}
export const dateLabel = (date) =>
  date
    ? new Intl.DateTimeFormat("en-GB", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      }).format(new Date(date.slice(0, 10) + "T12:00:00"))
    : "—";
