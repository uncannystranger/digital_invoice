import PDFDocument from "pdfkit";
import { formatMoney, dateLabel } from "../shared/finance.js";
export function pdfBuffer(inv) {
  return new Promise((resolve, reject) => {
    const d = new PDFDocument({
      size: "A4",
      margin: 45,
      bufferPages: true,
      info: {
        Title: `QAANSHEEG · ${inv.number}`,
        Author: inv.businessSnapshot.name,
      },
    });
    const chunks = [];
    d.on("data", (c) => chunks.push(c));
    d.on("end", () => resolve(Buffer.concat(chunks)));
    d.on("error", reject);
    const b = inv.businessSnapshot,
      c = inv.customerSnapshot;
    let y = 45;
    const ink = "#253c32",
      muted = "#66756b",
      accent = b.accent || "#556b4a";
    const text = (s, x, yy, w = 505, size = 9, color = ink, bold = false) => {
      d.font(bold ? "Helvetica-Bold" : "Helvetica")
        .fontSize(size)
        .fillColor(color)
        .text(String(s || ""), x, yy, { width: w, lineGap: 3 });
      return d.y;
    };
    const newPage = () => {
      d.addPage();
      y = 45;
      text(inv.number + " · QAANSHEEG", 45, y, 505, 10, muted);
      y += 30;
    };
    const space = (h) => {
      if (y + h > 755) newPage();
    };
    const tableHead = () => {
      d.roundedRect(45, y, 505, 27, 4).fill("#f0f3ed");
      text("SHARAXAAD", 55, y + 9, 255, 7, muted, true);
      text("TIRADA", 320, y + 9, 48, 7, muted, true);
      text("QIIMAHA", 375, y + 9, 76, 7, muted, true);
      text("WADARTA", 465, y + 9, 80, 7, muted, true);
      y += 33;
    };
    if (b.logo) {
      try {
        d.image(Buffer.from(b.logo.split(",")[1], "base64"), 45, y, {
          fit: [65, 45],
        });
      } catch {}
    }
    text(b.name, b.logo ? 125 : 45, y, 290, 20, ink, true);
    text("QAANSHEEG", 390, y, 160, 12, accent, true);
    text(inv.number, 390, y + 24, 160, 10);
    y += 65;
    y =
      text(
        [b.address, b.city, b.country, b.phone, b.email, b.website]
          .filter(Boolean)
          .join(" · "),
        45,
        y,
        505,
        8,
        muted,
      ) + 20;
    const by = y;
    text("KU SOCOTA", 45, y, 270, 7, muted, true);
    text(c.name, 45, y + 18, 270, 13, ink, true);
    const cy = text(
      [c.contact, c.address, c.city, c.phone, c.email]
        .filter(Boolean)
        .join("\n"),
      45,
      y + 39,
      270,
      9,
      muted,
    );
    text("La sameeyay: " + dateLabel(inv.issue), 340, by + 18, 210, 9);
    text("Kama dambaysta: " + dateLabel(inv.due), 340, by + 36, 210, 9);
    y = Math.max(cy, by + 60) + 25;
    tableHead();
    inv.items.forEach((item, index) => {
      d.font("Helvetica").fontSize(9);
      const h = Math.max(
        38,
        d.heightOfString(item.description, { width: 252, lineGap: 3 }) + 20,
      );
      if (y + h > 740) {
        newPage();
        tableHead();
      }
      text(item.description, 55, y + 10, 252, 9);
      text(item.quantity, 320, y + 10, 48, 9);
      text(
        formatMoney(Math.round(Number(item.price) * 100), inv.currency),
        375,
        y + 10,
        80,
        8,
      );
      text(
        formatMoney(inv.totals.lines[index], inv.currency),
        465,
        y + 10,
        80,
        8,
      );
      y += h;
      d.moveTo(45, y).lineTo(550, y).strokeColor("#e5eadf").stroke();
    });
    y += 15;
    space(190);
    const totals = [
      ["Wadarta Hoose", inv.totals.subtotal],
      ["Dhimis", -inv.totals.discount],
      ["Canshuur", inv.totals.tax],
      ["Wadarta Guud", inv.total],
      ["La bixiyey", inv.paid],
      ["Hadhaaga", inv.balance],
    ];
    totals.forEach(([label, v], n) => {
      if (n === 3 || n === 5)
        d.roundedRect(310, y - 4, 240, 26, 4).fill("#f0f3ed");
      text(label, 320, y, 125, n === 5 ? 11 : 9, ink, n === 3 || n === 5);
      text(
        formatMoney(v, inv.currency),
        442,
        y,
        104,
        n === 5 ? 11 : 9,
        ink,
        n === 3 || n === 5,
      );
      y += 28;
    });
    const block = (label, value) => {
      if (!value) return;
      d.font("Helvetica").fontSize(8);
      const height = d.heightOfString(value, { width: 505, lineGap: 3 }) + 38;
      space(height);
      y += 12;
      text(label, 45, y, 505, 7, muted, true);
      y = text(value, 45, y + 15, 505, 8, muted) + 8;
    };
    block(
      "HABKA LACAG-BIXINTA",
      b.methods
        .filter((m) => m.enabled && inv.paymentMethods.includes(m.name))
        .map((m) => `${m.name}: ${m.details}`)
        .join("\n"),
    );
    block("FAALLO", inv.notes);
    block("SHURUUDAHA", inv.terms);
    block("SAXIIXA", inv.signature);
    if (b.registration || b.taxNumber)
      block("DIIWAANGELINTA", `${b.registration || ""}  ${b.taxNumber || ""}`);
    const range = d.bufferedPageRange();
    for (let n = 0; n < range.count; n++) {
      d.switchToPage(n);
      d.page.margins.bottom = 0;
      d.moveTo(45, 785).lineTo(550, 785).strokeColor("#e5eadf").stroke();
      text("QAANSHEEG · Ganacsi hagaagsan.", 45, 794, 350, 7, muted);
      text(`${n + 1} / ${range.count}`, 495, 794, 55, 7, muted);
    }
    d.end();
  });
}
