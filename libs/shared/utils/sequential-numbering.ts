import type { PrismaClient } from '@prisma/client';

// ─── Supported document prefixes ─────────────────────────────────────────────

export type DocumentPrefix =
  | 'INV'   // Sales Invoice     → INV-000001
  | 'PO'    // Purchase Order    → PO-000001
  | 'GRN'   // Goods Receipt     → GRN-000001
  | 'RFP'   // Request for Prop  → RFP-000001
  | 'REQ'   // Requisition       → REQ-000001
  | 'VI'    // Vendor Invoice    → VI-000001
  | 'PAY'   // Vendor Payment    → PAY-000001
  | 'VPAY'; // Sales Payment ref → VPAY-000001

const PAD_LENGTH = 6;

// ─── Prisma table map ─────────────────────────────────────────────────────────

/**
 * Maps each prefix to the Prisma model name and the number field.
 * Extend this when adding new document types.
 *
 * Note: Prisma model accessor names are camelCase of the table name.
 */
const PREFIX_CONFIG: Record<
  DocumentPrefix,
  { model: string; field: string }
> = {
  INV:  { model: 'salesInvoice',   field: 'invoice_number'  },
  PO:   { model: 'purchaseOrder',  field: 'po_number'       },
  GRN:  { model: 'grn',            field: 'grn_number'      },
  RFP:  { model: 'rfp',            field: 'rfp_number'      },
  REQ:  { model: 'requisition',    field: 'req_number'      },
  VI:   { model: 'vendorInvoice',  field: 'invoice_number'  },
  PAY:  { model: 'vendorPayment',  field: 'payment_ref'     },
  VPAY: { model: 'salesPayment',   field: 'payment_ref'     },
};

// ─── Format helpers ───────────────────────────────────────────────────────────

export function formatDocumentNumber(prefix: DocumentPrefix, seq: number): string {
  return `${prefix}-${String(seq).padStart(PAD_LENGTH, '0')}`;
}

export function parseSequenceNumber(
  prefix: DocumentPrefix,
  docNumber: string,
): number {
  const regex = new RegExp(`^${prefix}-(\\d+)$`);
  const match = docNumber.match(regex);
  return match ? parseInt(match[1], 10) : 0;
}

// ─── Generator ───────────────────────────────────────────────────────────────

/**
 * Generates the next sequential document number for the given prefix.
 *
 * Strategy: fetch the latest document ordered by createdAt DESC, parse
 * its sequence number, increment. This mirrors the existing generateInvoiceNumber()
 * logic in utils/invoiceNumber.ts and replaces it for all document types.
 *
 * ⚠️  Race condition note: this approach (read-then-write) is acceptable for
 * low-volume MVP. For high concurrency, replace with a Postgres sequence:
 *   SELECT nextval('inv_seq') — and store in a sequences table.
 *
 * @example
 *   const poNumber = await generateDocumentNumber(prisma, 'PO');
 *   // → 'PO-000001' (if no POs exist yet)
 */
export async function generateDocumentNumber(
  prisma: PrismaClient,
  prefix: DocumentPrefix,
): Promise<string> {
  const { model, field } = PREFIX_CONFIG[prefix];

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const repo = (prisma as any)[model];
  if (!repo) {
    throw new Error(`Unknown Prisma model for prefix "${prefix}": "${model}"`);
  }

  const latest = await repo.findFirst({
    orderBy: { created_at: 'desc' },
    select: { [field]: true },
  });

  const latestNumber: string | undefined = latest?.[field];
  let next = 1;

  if (latestNumber) {
    const parsed = parseSequenceNumber(prefix, latestNumber);
    if (parsed > 0) next = parsed + 1;
  }

  return formatDocumentNumber(prefix, next);
}
