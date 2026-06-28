// ─────────────────────────────────────────────────────────────────────────────
// libs/ap/rfp/rfp.services.ts
// ─────────────────────────────────────────────────────────────────────────────
import { Prisma, RFPStatus, RequisitionStatus } from '@prisma/client';
import { prisma } from '../../../apps/api/src/config/prisma';
import { generateDocumentNumber } from '../../shared/utils/sequential-numbering';

export interface CreateRfpInput {
  requisition_id: string;
  title: string;
  description?: string;
  deadline?: Date;
}

export interface SubmitQuoteInput {
  vendor_id: string;
  unit_price: number;
  total_amount: number;
  lead_time_days?: number;
  validity_days?: number;
  notes?: string;
}

export interface EvaluateRfpInput {
  selected_quote_id: string;
  evaluations: {
    vendor_quote_id: string;
    score?: number;
    price_score?: number;
    quality_score?: number;
    lead_time_score?: number;
    notes?: string;
  }[];
}

// ── List ──────────────────────────────────────────────────────────────────────
export async function listRfps(query: {
  status?: string; search?: string; page?: string; limit?: string;
}) {
  const page  = Math.max(1, parseInt(query.page  ?? '1',  10));
  const limit = Math.min(50, parseInt(query.limit ?? '20', 10));

  const where: Prisma.RFPWhereInput = {
    ...(query.status && { status: query.status as RFPStatus }),
    ...(query.search && {
      OR: [
        { title:      { contains: query.search, mode: 'insensitive' } },
        { rfp_number: { contains: query.search, mode: 'insensitive' } },
      ],
    }),
  };

  const [rfps, total] = await prisma.$transaction([
    prisma.rFP.findMany({
      where,
      include: {
        requisition:   { select: { req_number: true, title: true } },
        vendor_quotes: { include: { vendor: { select: { vendor_name: true } } } },
        _count: { select: { vendor_quotes: true } },
      },
      orderBy: { created_at: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.rFP.count({ where }),
  ]);

  return { rfps, pagination: { page, limit, total, pages: Math.ceil(total / limit) } };
}

// ── Get one ───────────────────────────────────────────────────────────────────
export async function getRfpById(id: string) {
  const rfp = await prisma.rFP.findUnique({
    where: { id },
    include: {
      requisition:       { include: { items: true } },
      vendor_quotes:     { include: { vendor: true, evaluation: true } },
      quote_evaluations: true,
    },
  });
  if (!rfp) throw Object.assign(new Error('RFP not found'), { statusCode: 404 });
  return rfp;
}

// ── Create ────────────────────────────────────────────────────────────────────
// Requisition must be APPROVED. Creates the RFP and atomically advances
// requisition status to converted_to_rfp.
export async function createRfp(input: CreateRfpInput) {
  const requisition = await prisma.requisition.findUnique({
    where: { id: input.requisition_id },
  });
  if (!requisition) {
    throw Object.assign(new Error('Requisition not found'), { statusCode: 404 });
  }
  if (requisition.status !== RequisitionStatus.approved) {
    throw Object.assign(
      new Error('Requisition must be APPROVED before creating an RFP'),
      { statusCode: 409 },
    );
  }

  const rfp_number = await generateDocumentNumber(prisma, 'RFP');

  return prisma.$transaction(async (tx) => {
    const newRfp = await tx.rFP.create({
      data: {
        rfp_number,
        requisition_id: input.requisition_id,
        title:          input.title,
        description:    input.description,
        deadline:       input.deadline,
        status:         RFPStatus.open,
      },
      include: { vendor_quotes: true },
    });
    await tx.requisition.update({
      where: { id: input.requisition_id },
      data:  { status: RequisitionStatus.converted_to_rfp },
    });
    return newRfp;
  });
}

// ── Update (OPEN only) ────────────────────────────────────────────────────────
export async function updateRfp(id: string, input: Partial<CreateRfpInput>) {
  const existing = await prisma.rFP.findUnique({ where: { id } });
  if (!existing) throw Object.assign(new Error('RFP not found'), { statusCode: 404 });
  if (existing.status !== RFPStatus.open) {
    throw Object.assign(new Error('Only OPEN RFPs can be edited'), { statusCode: 409 });
  }
  return prisma.rFP.update({
    where: { id },
    data: {
      title:       input.title,
      description: input.description,
      deadline:    input.deadline,
    },
    include: { vendor_quotes: true },
  });
}

// ── Submit vendor quote ───────────────────────────────────────────────────────
// Upserts by (rfp_id, vendor_id) — re-submitting replaces the existing quote.
export async function submitVendorQuote(rfpId: string, input: SubmitQuoteInput) {
  const rfp = await prisma.rFP.findUnique({ where: { id: rfpId } });
  if (!rfp) throw Object.assign(new Error('RFP not found'), { statusCode: 404 });
  if (rfp.status !== RFPStatus.open) {
    throw Object.assign(new Error('RFP is not open for quotes'), { statusCode: 409 });
  }

  const vendor = await prisma.vendor.findFirst({
    where: { id: input.vendor_id, is_deleted: false },
  });
  if (!vendor) throw Object.assign(new Error('Vendor not found'), { statusCode: 404 });

  return prisma.vendorQuote.upsert({
    where: { rfp_id_vendor_id: { rfp_id: rfpId, vendor_id: input.vendor_id } },
    create: {
      rfp_id:         rfpId,
      vendor_id:      input.vendor_id,
      unit_price:     new Prisma.Decimal(input.unit_price),
      total_amount:   new Prisma.Decimal(input.total_amount),
      lead_time_days: input.lead_time_days,
      validity_days:  input.validity_days,
      notes:          input.notes,
    },
    update: {
      unit_price:     new Prisma.Decimal(input.unit_price),
      total_amount:   new Prisma.Decimal(input.total_amount),
      lead_time_days: input.lead_time_days,
      validity_days:  input.validity_days,
      notes:          input.notes,
    },
    include: { vendor: true },
  });
}

// ── Evaluate + select vendor ──────────────────────────────────────────────────
// Records scores for all evaluated quotes, marks the selected quote, and
// advances RFP status to vendor_selected (not "awarded" — that value does
// not exist in RFPStatus; the schema uses vendor_selected).
export async function evaluateRfp(rfpId: string, input: EvaluateRfpInput) {
  const rfp = await prisma.rFP.findUnique({
    where:   { id: rfpId },
    include: { vendor_quotes: true },
  });
  if (!rfp) throw Object.assign(new Error('RFP not found'), { statusCode: 404 });

  // FIX: was RFPStatus.awarded — does not exist. Schema has vendor_selected.
  if (rfp.status === RFPStatus.vendor_selected) {
    throw Object.assign(new Error('Vendor has already been selected for this RFP'), { statusCode: 409 });
  }

  const selectedQuote = rfp.vendor_quotes.find((q) => q.id === input.selected_quote_id);
  if (!selectedQuote) {
    throw Object.assign(
      new Error('Selected quote does not belong to this RFP'),
      { statusCode: 409 },
    );
  }

  return prisma.$transaction(async (tx) => {
    for (const ev of input.evaluations) {
      await tx.quoteEvaluation.upsert({
        where: { vendor_quote_id: ev.vendor_quote_id },
        create: {
          rfp_id:          rfpId,
          vendor_quote_id: ev.vendor_quote_id,
          score:           ev.score,
          price_score:     ev.price_score,
          quality_score:   ev.quality_score,
          lead_time_score: ev.lead_time_score,
          notes:           ev.notes,
          is_selected:     ev.vendor_quote_id === input.selected_quote_id,
          selected_at:     ev.vendor_quote_id === input.selected_quote_id ? new Date() : null,
        },
        update: {
          score:           ev.score,
          price_score:     ev.price_score,
          quality_score:   ev.quality_score,
          lead_time_score: ev.lead_time_score,
          notes:           ev.notes,
          is_selected:     ev.vendor_quote_id === input.selected_quote_id,
          selected_at:     ev.vendor_quote_id === input.selected_quote_id ? new Date() : null,
        },
      });
    }

    // FIX: was RFPStatus.awarded — corrected to vendor_selected
    return tx.rFP.update({
      where: { id: rfpId },
      data:  { status: RFPStatus.vendor_selected },
      include: {
        vendor_quotes:     { include: { vendor: true, evaluation: true } },
        quote_evaluations: true,
      },
    });
  });
}