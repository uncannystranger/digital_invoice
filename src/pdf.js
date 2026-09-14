import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { calculate, formatMoney, dateLabel } from "../shared/finance";

const PDF = {
  width: 210,
  height: 297,
  margin: 16,
  accent: [8, 107, 138],
  text: [32, 40, 32],
  muted: [104, 108, 102],
  border: [224, 227, 222],
  surface: [245, 246, 244],
};

function hexColor(value, fallback) {
  const match = /^#?([0-9a-f]{6})$/i.exec(value || "");
  return match
    ? [
        parseInt(match[1].slice(0, 2), 16),
        parseInt(match[1].slice(2, 4), 16),
        parseInt(match[1].slice(4, 6), 16),
      ]
    : fallback;
}

function logoSize(data) {
  return new Promise((resolve) => {
    if (!data) return resolve(null);
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(12 / img.width, 12 / img.height, 1);
      resolve({
        width: Math.max(6, img.width * scale),
        height: Math.max(6, img.height * scale),
      });
    };
    img.onerror = () => resolve(null);
    img.src = data;
  });
}

export async function invoicePdf(invoice) {
  await document.fonts?.ready;
  const d = new jsPDF({ unit: "mm", format: "a4", compress: true });
  const b = invoice.businessSnapshot || {},
    c = invoice.customerSnapshot || {};
  const accent = hexColor(b.accent, PDF.accent);
  const totals = calculate(invoice),
    currency = invoice.currency || "USD";
  const money = (value) => formatMoney(value, currency);
  const left = PDF.margin,
    right = 210 - PDF.margin,
    content = right - left;
  const setText = (size, color = PDF.text, style = "normal") => {
    d.setFont("helvetica", style);
    d.setFontSize(size);
    d.setTextColor(...color);
  };
  const initials = (b.name || "Q")
    .split(" ")
    .slice(0, 2)
    .map((x) => x[0])
    .join("")
    .toUpperCase();
  let y = 17;
  const logo =
    typeof b.logo === "string" && b.logo.startsWith("data:image/")
      ? b.logo
      : null;
  const logoMetrics = await logoSize(logo);
  if (logo && logoMetrics) {
    try {
      d.addImage(
        logo,
        "AUTO",
        left,
        y,
        logoMetrics.width,
        logoMetrics.height,
        undefined,
        "FAST",
      );
    } catch {
      /* initials fallback */
    }
  } else {
    d.setFillColor(...accent);
    d.roundedRect(left, y, 12, 12, 2, 2, "F");
    setText(9, [255, 255, 255], "bold");
    d.text(initials, left + 6, y + 7.7, { align: "center" });
  }
  const identityX = left + (logoMetrics ? logoMetrics.width + 4 : 16);
  setText(13, PDF.text, "bold");
  d.text(b.name || "Magaca ganacsiga", identityX, y + 5.5);
  setText(8.5, PDF.muted);
  d.text([b.city, b.country].filter(Boolean).join(" · "), identityX, y + 10);
  setText(12, accent, "bold");
  d.text("QAANSHEEG", right, y + 4, { align: "right" });
  setText(8.5, PDF.muted);
  d.text(invoice.number || "Qabyo", right, y + 10, { align: "right" });
  y += 19;
  d.setDrawColor(...accent);
  d.setLineWidth(0.7);
  d.line(left, y, right, y);
  y += 7;
  setText(8.5, PDF.muted);
  d.text(
    [b.address, b.phone, b.email, b.website].filter(Boolean).join(" · "),
    left,
    y,
  );
  y += 15;
  setText(8.5, PDF.muted);
  d.text("Ku socota", left, y);
  setText(11, PDF.text, "bold");
  d.text(c.name || "Dooro macmiil", left, y + 6);
  setText(8.5, PDF.muted);
  d.text(
    d.splitTextToSize(
      [c.contact, c.address, c.city, c.phone, c.email]
        .filter(Boolean)
        .join("\n"),
      72,
    ),
    left,
    y + 12,
  );
  const dateX = right - 43;
  [
    ["Taariikh", dateLabel(invoice.issue)],
    ["Taariikhda bixinta", dateLabel(invoice.due)],
    ["Lacagta", currency],
  ].forEach(([label, value], index) => {
    const yy = y + index * 13;
    setText(8.5, PDF.muted);
    d.text(label, dateX, yy);
    setText(8.5, PDF.text, "bold");
    d.text(value, right, yy, { align: "right" });
  });
  y += 47;
  autoTable(d, {
    startY: y,
    margin: { left, right: PDF.margin },
    tableWidth: content,
    head: [["Sharaxaad", "Tirada", "Qiimaha", "Wadarta"]],
    body: invoice.items.map((item, n) => [
      item.description || "Sharaxaadda shayga",
      String(item.quantity),
      money(Math.round(Number(item.price || 0) * 100)),
      money(totals.lines[n] || 0),
    ]),
    theme: "grid",
    styles: {
      font: "helvetica",
      fontSize: 8.5,
      textColor: PDF.text,
      lineColor: PDF.border,
      lineWidth: 0.15,
      cellPadding: { top: 4, right: 3, bottom: 4, left: 3 },
      overflow: "linebreak",
    },
    headStyles: {
      fillColor: PDF.surface,
      textColor: PDF.muted,
      fontStyle: "normal",
      lineColor: PDF.border,
    },
    alternateRowStyles: { fillColor: [255, 255, 255] },
    columnStyles: {
      0: { cellWidth: 78, halign: "left" },
      1: { cellWidth: 22, halign: "right" },
      2: { cellWidth: 35, halign: "right" },
      3: { cellWidth: 39, halign: "right" },
    },
    rowPageBreak: "avoid",
    showHead: "everyPage",
  });
  y = d.lastAutoTable.finalY + 8;
  const totalsRows = [
    ["Wadarta hoose", money(totals.subtotal)],
    ["Dhimis", money(-totals.discount)],
    ["Canshuur", money(totals.tax)],
    ["Wadarta Guud", money(totals.total)],
    ["La bixiyey", money(invoice.paid || 0)],
    ["Hadhaaga", money(totals.total - (invoice.paid || 0))],
  ];
  autoTable(d, {
    startY: y,
    margin: { left: 112, right: PDF.margin },
    tableWidth: 82,
    body: totalsRows,
    theme: "plain",
    styles: {
      font: "helvetica",
      fontSize: 9,
      textColor: PDF.text,
      cellPadding: { top: 2.5, right: 0, bottom: 2.5, left: 0 },
    },
    columnStyles: { 0: { halign: "left" }, 1: { halign: "right" } },
    didParseCell: (data) => {
      if (data.row.index === 3 || data.row.index === 5)
        data.cell.styles.fontStyle = "bold";
      if (data.row.index === 5) data.cell.styles.textColor = accent;
    },
    didDrawCell: (data) => {
      if ([3, 5].includes(data.row.index) && data.column.index === 0) {
        d.setDrawColor(...PDF.border);
        d.line(112, data.cell.y - 1.5, right, data.cell.y - 1.5);
      }
    },
  });
  y = d.lastAutoTable.finalY + 9;
  const sections = [];
  const methods = b.methods
    ?.filter((m) => m.enabled && invoice.paymentMethods?.includes(m.name))
    .map((m) => `${m.name}${m.details ? ` · ${m.details}` : ""}`)
    .join("\n");
  if (methods) sections.push(["Habka lacag-bixinta", methods]);
  if (invoice.notes) sections.push(["Qoraal", invoice.notes]);
  if (invoice.terms) sections.push(["Shuruudaha", invoice.terms]);
  if (invoice.signature) sections.push(["Saxiixa", invoice.signature]);
  if (b.footer) sections.push(["", b.footer]);
  if (invoice.sample)
    sections.push(["", "TUSAALE KELIYA · Xiriir ganacsi lama sheeganayo"]);
  sections.forEach(([label, value]) => {
    setText(8, PDF.muted, "bold");
    d.text(label, left, y);
    setText(8.5, PDF.text);
    const lines = d.splitTextToSize(value, content);
    d.text(lines, left, y + 5);
    y += 5 + lines.length * 4.5 + 4;
  });
  for (let page = 1; page <= d.getNumberOfPages(); page += 1) {
    d.setPage(page);
    setText(7, PDF.muted);
    d.text(
      `${invoice.number || "Qabyo"} · ${page} / ${d.getNumberOfPages()}`,
      left,
      PDF.height - 9,
    );
  }
  return d;
}

export async function downloadInvoice(invoice) {
  const d = await invoicePdf(invoice);
  d.save(`${invoice.number}.pdf`);
}
export async function printInvoice(invoice) {
  const d = await invoicePdf(invoice);
  d.autoPrint();
  const url = d.output("bloburl");
  const w = window.open(url, "_blank");
  if (!w) throw new Error("Oggolow daaqadda daabacaadda browser-ka.");
  setTimeout(() => URL.revokeObjectURL(url), 60000);
}
