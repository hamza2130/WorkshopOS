import type { ApprovalStatus, EstimateStatus, InspectionCategory, InspectionOutcome, ItemKind, ItemSource } from "@/lib/estimates";

// Shape returned by public.get_estimate_for_customer().
export type CustomerEstimate = {
  workshop: { name: string; phone: string | null; city: string | null; currency: string; timezone: string };
  job_number: string;
  vehicle: { registration: string; make: string; model: string };
  customer_first_name: string;
  complaint: string;
  estimate: {
    version: number;
    status: EstimateStatus;
    sent_at: string;
    decided_at: string | null;
    expires_at: string;
    expired: boolean;
    subtotal: number;
    discount_total: number;
    tax_label: string;
    tax_rate: number;
    tax_total: number;
    total: number;
    estimated_completion: string | null;
    terms: string | null;
    customer_note: string | null;
  };
  items: {
    id: string;
    kind: ItemKind;
    source: ItemSource;
    inspection_category: InspectionCategory | null;
    description: string;
    quantity: number;
    unit_price: number;
    discount: number;
    line_total: number;
    taxable: boolean;
    approval_status: ApprovalStatus;
  }[];
  findings: { category: InspectionCategory; outcome: InspectionOutcome; notes: string | null }[];
  decision: { method: string; customer_name: string | null; approved_total: number; decided_at: string } | null;
};
