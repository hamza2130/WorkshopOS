import { degrees, PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";

// A4 invoice, made on request (no background job): generation takes milliseconds.
// Uses the PDF standard fonts, which cover English and Western European letters
// only; anything else (e.g. Urdu) is replaced with "?" rather than failing.

export type InvoicePdfData = {
  workshop: { name: string; address: string | null; city: string | null; phone: string | null; email: string | null };
  invoiceNumber: string | null; // null while a draft
  status: "draft" | "issued" | "void";
  issuedAt: string | null; // already formatted for the workshop's time zone
  jobNumber: string;
  customer: { name: string; phone: string | null };
  vehicle: { registration: string; description: string | null; odometer: number | null };
  lines: { description: string; kind: string; quantity: number; unitPrice: string; discount: string | null; amount: string }[];
  totals: { label: string; value: string; strong?: boolean }[];
  payments: { date: string; label: string; amount: string }[];
  notes: string | null;
  voidReason: string | null;
};

const A4: [number, number] = [595.28, 841.89];
const MARGIN = 48;
const INK = rgb(0.06, 0.09, 0.16);
const MUTED = rgb(0.39, 0.45, 0.55);
const RULE = rgb(0.86, 0.88, 0.91);
const BRAND = rgb(0.12, 0.35, 0.67);

// Windows-1252 is what the standard fonts can draw.
const CP1252_EXTRA = "€‚ƒ„…†‡ˆ‰Š‹ŒŽ‘’“”•–—˜™š›œžŸ";
export function pdfSafe(text: string) {
  let out = "";
  for (const ch of text.replace(/\r\n?/g, "\n")) {
    const code = ch.codePointAt(0)!;
    if (ch === "\n" || (code >= 0x20 && code <= 0x7e) || (code >= 0xa0 && code <= 0xff) || CP1252_EXTRA.includes(ch)) out += ch;
    else if (code === 0x2212) out += "-"; // minus sign
    else if (code === 0x202f) out += " "; // narrow no-break space (Intl output)
    else out += "?";
  }
  return out;
}

function wrap(text: string, font: PDFFont, size: number, width: number) {
  const lines: string[] = [];
  for (const para of pdfSafe(text).split("\n")) {
    let line = "";
    for (const word of para.split(/\s+/).filter(Boolean)) {
      const next = line ? `${line} ${word}` : word;
      if (font.widthOfTextAtSize(next, size) <= width) line = next;
      else {
        if (line) lines.push(line);
        // A single word wider than the column is cut, not overflowed.
        let w = word;
        while (font.widthOfTextAtSize(w, size) > width && w.length > 1) w = w.slice(0, -1);
        line = w;
      }
    }
    lines.push(line);
  }
  return lines;
}

export async function renderInvoicePdf(d: InvoicePdfData): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  doc.setTitle(pdfSafe(d.invoiceNumber ? `Invoice ${d.invoiceNumber}` : `Draft invoice ${d.jobNumber}`));
  doc.setProducer("WorkshopOS");
  const regular = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);

  let page: PDFPage = doc.addPage(A4);
  let y = A4[1] - MARGIN;
  const right = A4[0] - MARGIN;
  const width = right - MARGIN;

  const text = (s: string, x: number, at: number, opts: { size?: number; font?: PDFFont; color?: typeof INK; align?: "left" | "right" } = {}) => {
    const size = opts.size ?? 10;
    const font = opts.font ?? regular;
    const safe = pdfSafe(s);
    const dx = opts.align === "right" ? font.widthOfTextAtSize(safe, size) : 0;
    page.drawText(safe, { x: x - dx, y: at, size, font, color: opts.color ?? INK });
  };
  const rule = (at: number) => page.drawLine({ start: { x: MARGIN, y: at }, end: { x: right, y: at }, thickness: 0.6, color: RULE });

  function stamp() {
    if (d.status === "issued") return;
    const word = d.status === "void" ? "VOID" : "DRAFT";
    page.drawText(word, { x: 150, y: 330, size: 110, font: bold, color: rgb(0.85, 0.2, 0.2), opacity: 0.12, rotate: degrees(35) });
  }

  // Header: workshop on the left, document title on the right.
  text(d.workshop.name, MARGIN, y - 4, { size: 16, font: bold });
  text(d.status === "draft" ? "DRAFT INVOICE" : "INVOICE", right, y - 4, { size: 16, font: bold, color: BRAND, align: "right" });
  y -= 22;
  const contact = [d.workshop.address, d.workshop.city].filter(Boolean).join(", ");
  for (const line of [contact, [d.workshop.phone, d.workshop.email].filter(Boolean).join(" · ")].filter(Boolean)) {
    text(line, MARGIN, y, { size: 9, color: MUTED });
    y -= 12;
  }
  let ry = A4[1] - MARGIN - 26;
  for (const [k, v] of [
    ["Invoice no.", d.invoiceNumber ?? "Not issued"],
    ["Date", d.issuedAt ?? "—"],
    ["Job card", d.jobNumber],
  ]) {
    text(k, right - 120, ry, { size: 9, color: MUTED });
    text(v, right, ry, { size: 9, font: bold, align: "right" });
    ry -= 13;
  }
  y = Math.min(y, ry) - 14;
  rule(y);
  y -= 18;

  // Bill to / vehicle.
  text("BILL TO", MARGIN, y, { size: 8, font: bold, color: MUTED });
  text("VEHICLE", MARGIN + width / 2, y, { size: 8, font: bold, color: MUTED });
  y -= 14;
  text(d.customer.name, MARGIN, y, { size: 11, font: bold });
  text(d.vehicle.registration, MARGIN + width / 2, y, { size: 11, font: bold });
  y -= 13;
  if (d.customer.phone) text(d.customer.phone, MARGIN, y, { size: 9 });
  if (d.vehicle.description) text(d.vehicle.description, MARGIN + width / 2, y, { size: 9 });
  y -= 12;
  if (d.vehicle.odometer != null) text(`Odometer: ${d.vehicle.odometer.toLocaleString("en-PK")} km`, MARGIN + width / 2, y, { size: 9 });
  y -= 22;

  // Lines.
  const col = { qty: right - 220, price: right - 150, disc: right - 80, amount: right };
  const header = () => {
    page.drawRectangle({ x: MARGIN, y: y - 5, width, height: 18, color: rgb(0.96, 0.97, 0.98) });
    text("DESCRIPTION", MARGIN + 6, y, { size: 8, font: bold, color: MUTED });
    text("QTY", col.qty, y, { size: 8, font: bold, color: MUTED, align: "right" });
    text("PRICE", col.price, y, { size: 8, font: bold, color: MUTED, align: "right" });
    text("DISCOUNT", col.disc, y, { size: 8, font: bold, color: MUTED, align: "right" });
    text("AMOUNT", col.amount - 6, y, { size: 8, font: bold, color: MUTED, align: "right" });
    y -= 20;
  };
  stamp();
  header();
  for (const l of d.lines) {
    const desc = wrap(l.description, regular, 9.5, col.qty - 60 - MARGIN);
    // Description lines, a small kind label, then the divider with room above the next row.
    const height = desc.length * 12 + 22;
    if (y - height < MARGIN + 40) {
      page = doc.addPage(A4);
      y = A4[1] - MARGIN;
      stamp();
      header();
    }
    desc.forEach((s, i) => text(s, MARGIN + 6, y - i * 12, { size: 9.5 }));
    const kindY = y - desc.length * 12 + 1;
    text(l.kind, MARGIN + 6, kindY, { size: 7.5, color: MUTED });
    text(String(l.quantity), col.qty, y, { size: 9.5, align: "right" });
    text(l.unitPrice, col.price, y, { size: 9.5, align: "right" });
    text(l.discount ?? "—", col.disc, y, { size: 9.5, align: "right", color: l.discount ? INK : MUTED });
    text(l.amount, col.amount - 6, y, { size: 9.5, font: bold, align: "right" });
    rule(kindY - 6);
    y -= height;
  }

  // Totals, right-aligned; payments listed under them.
  const needed = (d.totals.length + d.payments.length + 2) * 15 + (d.notes ? 60 : 0) + (d.voidReason ? 30 : 0);
  if (y - needed < MARGIN) {
    page = doc.addPage(A4);
    y = A4[1] - MARGIN;
    stamp();
  }
  y -= 8;
  for (const t of d.totals) {
    text(t.label, right - 200, y, { size: t.strong ? 11 : 9.5, font: t.strong ? bold : regular, color: t.strong ? INK : MUTED });
    text(t.value, right - 6, y, { size: t.strong ? 11 : 9.5, font: t.strong ? bold : regular, align: "right" });
    y -= t.strong ? 17 : 14;
  }
  if (d.payments.length) {
    y -= 8;
    text("PAYMENTS", MARGIN, y, { size: 8, font: bold, color: MUTED });
    y -= 13;
    for (const p of d.payments) {
      text(`${p.date} · ${p.label}`, MARGIN, y, { size: 9 });
      text(p.amount, right - 6, y, { size: 9, align: "right" });
      y -= 13;
    }
  }
  if (d.notes) {
    y -= 10;
    text("NOTES", MARGIN, y, { size: 8, font: bold, color: MUTED });
    y -= 13;
    for (const s of wrap(d.notes, regular, 9, width).slice(0, 8)) {
      text(s, MARGIN, y, { size: 9 });
      y -= 12;
    }
  }
  if (d.voidReason) {
    y -= 10;
    text(`Voided: ${d.voidReason}`, MARGIN, y, { size: 9.5, font: bold, color: rgb(0.7, 0.1, 0.1) });
  }

  const pages = doc.getPages();
  pages.forEach((p, i) => {
    page = p;
    text(`${d.workshop.name} · ${d.invoiceNumber ?? "Draft"} · page ${i + 1} of ${pages.length}`, MARGIN, 26, { size: 7.5, color: MUTED });
    text("Thank you for your business.", right, 26, { size: 7.5, color: MUTED, align: "right" });
  });
  return doc.save();
}
