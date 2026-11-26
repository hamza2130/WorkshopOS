import { PDFDocument } from "pdf-lib";
import { describe, expect, it } from "vitest";
import { pdfSafe, renderInvoicePdf, type InvoicePdfData } from "./invoice-pdf";

const base: InvoicePdfData = {
  workshop: { name: "Alpha Motors", address: "12 Ferozepur Road", city: "Lahore", phone: "042 1234567", email: null },
  invoiceNumber: "INV-0001",
  status: "issued",
  issuedAt: "26 Nov 2026",
  jobNumber: "JC-0001",
  customer: { name: "Usman Tariq", phone: "0301 5551234" },
  vehicle: { registration: "LEC-2468", description: "Toyota Corolla GLi 2017", odometer: 98500 },
  lines: [{ description: "Replace front brake pads and skim discs", kind: "Labour", quantity: 1, unitPrice: "Rs 3,500", discount: null, amount: "Rs 3,500" }],
  totals: [
    { label: "Subtotal", value: "Rs 3,500" },
    { label: "Total", value: "Rs 3,500", strong: true },
  ],
  payments: [{ date: "26 Nov 2026, 9:30 pm", label: "Cash", amount: "Rs 3,500" }],
  notes: "3-month warranty on brake pads",
  voidReason: null,
};

describe("renderInvoicePdf", () => {
  it("makes a one-page A4 PDF titled with the invoice number", async () => {
    const bytes = await renderInvoicePdf(base);
    expect(new TextDecoder().decode(bytes.slice(0, 5))).toBe("%PDF-");
    const doc = await PDFDocument.load(bytes);
    expect(doc.getPageCount()).toBe(1);
    expect(doc.getTitle()).toBe("Invoice INV-0001");
  });

  it("flows long invoices onto more pages instead of running off the page", async () => {
    const lines = Array.from({ length: 60 }, (_, i) => ({ ...base.lines[0], description: `Line ${i + 1}: ${"long description ".repeat(6)}` }));
    const doc = await PDFDocument.load(await renderInvoicePdf({ ...base, lines }));
    expect(doc.getPageCount()).toBeGreaterThan(2);
  });

  it("doesn't fail on text the PDF fonts can't draw, like Urdu names", async () => {
    const bytes = await renderInvoicePdf({ ...base, customer: { name: "عثمان طارق", phone: null }, status: "void", voidReason: "Wrong customer" });
    expect(bytes.length).toBeGreaterThan(1000);
    expect(pdfSafe("Usman – 3½ × Rs 1,000 عثمان")).toBe("Usman – 3½ × Rs 1,000 ?????");
  });
});
