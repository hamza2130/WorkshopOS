import { describe, expect, it } from "vitest";
import { invoiceError, invoiceLineSchema, invoiceMessage, paymentSchema, paymentState, refundSchema, voidSchema } from "./invoices";

const id = "5b2f3f43-2d8c-4a39-9b39-6a5f4f0c1a11";

describe("paymentState", () => {
  it("names what the customer owes", () => {
    expect(paymentState("draft", 100, 0)).toBe("draft");
    expect(paymentState("void", 100, 0)).toBe("void");
    expect(paymentState("issued", 100, 0)).toBe("unpaid");
    expect(paymentState("issued", 100, 40)).toBe("part_paid");
    expect(paymentState("issued", 100, 100)).toBe("paid");
    // A free job (warranty, goodwill) is settled the moment it's issued.
    expect(paymentState("issued", 0, 0)).toBe("paid");
  });
});

describe("invoice forms", () => {
  it("reads amounts with commas and refuses zero or junk", () => {
    expect(paymentSchema.parse({ invoiceId: id, amount: "9,350", method: "cash", reference: " ", note: "" })).toMatchObject({
      amount: 9350,
      reference: null,
      note: null,
    });
    for (const amount of ["0", "-5", "abc", "", "1.234"]) {
      expect(paymentSchema.safeParse({ invoiceId: id, amount, method: "cash" }).success, amount).toBe(false);
    }
    expect(paymentSchema.safeParse({ invoiceId: id, amount: "10", method: "bitcoin" }).success).toBe(false);
  });

  it("requires a reason for refunds and voids", () => {
    expect(refundSchema.safeParse({ invoiceId: id, paymentId: id, amount: "10", method: "cash", reason: "  " }).success).toBe(false);
    expect(voidSchema.safeParse({ invoiceId: id, reason: "ok" }).success).toBe(false);
    expect(voidSchema.parse({ invoiceId: id, reason: " Billed twice " }).reason).toBe("Billed twice");
  });

  it("keeps a line's discount within its amount", () => {
    const line = { kind: "part", description: "Pads", partId: "", quantity: "2", unitPrice: "1000", taxable: "on" };
    expect(invoiceLineSchema.parse({ ...line, discount: "500" })).toMatchObject({ quantity: 2, unitPrice: 1000, discount: 500, taxable: true, partId: null });
    expect(invoiceLineSchema.safeParse({ ...line, discount: "2001" }).success).toBe(false);
  });
});

describe("messages", () => {
  it("turns database codes into words, keeping the database's own figures", () => {
    expect(invoiceError({ message: "invoice_has_payments" }, "x")).toMatch(/Refund the payments/);
    expect(invoiceError({ message: "overpayment", details: "Only 4350.00 is still due on this invoice." }, "x")).toMatch(/4350/);
    expect(invoiceError({ message: "something_else" }, "fallback")).toBe("fallback");
  });

  it("writes the WhatsApp text for unpaid and paid invoices", () => {
    const base = { customerName: "Kamran Shah", workshopName: "Alpha Motors", invoiceNumber: "INV-0007", vehicle: "LEF-6001", total: "Rs 9,350", balance: "Rs 4,350" };
    expect(invoiceMessage({ ...base, paid: false })).toBe(
      "Assalam-o-Alaikum Kamran, your LEF-6001 invoice INV-0007 from Alpha Motors is Rs 9,350. Balance due: Rs 4,350.",
    );
    expect(invoiceMessage({ ...base, paid: true })).toMatch(/fully paid/);
  });
});
