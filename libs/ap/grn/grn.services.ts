// ─────────────────────────────────────────────────────────────────────────────
// libs/ap/grn/grn.services.ts
//
// GRNStatus is draft → confirmed (matches schema exactly — no intermediate
// "received"/"posted" states). A GRN is created in draft, then confirmed once
// the recorded quantities are final. Confirming a GRN is what makes it
// eligible for 3-way matching — match.engine.ts only looks at GRNs with
// status === 'confirmed'.
//
// PO fulfillment (partial/full delivery) is NOT tracked on PurchaseOrder.
// It is always derived by summing confirmed GRN item quantities against PO
// item quantities — see getPurchaseOrderFulfillment() in po.services.ts.
// ─────────────────────────────────────────────────────────────────────────────

import { Prisma, GRNStatus, POStatus } from '@prisma/client';
import { prisma } from '../../../apps/api/src/config/prisma';
import { generateDocumentNumber } from '../../shared/utils/sequential-numbering';

export interface GRNItemInput {
  po_item_id: string;
  quantity_received: number;
  notes?: string;
}

export interface CreateGRNInput {
  po_id: string;
  received_by?: string;
  received_at?: Date;
  delivery_note_number?: string;
  notes?: string;
  items: GRNItemInput[];
}

// ── List ──────────────────────────────────────────────────────────────────

export async function listGrns(query: {
  po_id?: string;
  status?: string;
  page?: string;
  limit?: string;
}) {
  const page = Math.max(1, parseInt(query.page ?? '1', 10));
  const limit = Math.min(50, parseInt(query.limit ?? '20', 10));

  const where: Prisma.GRNWhereInput = {
    ...(query.po_id && { po_id: query.po_id }),
    ...(query.status && { status: query.status as GRNStatus }),
  };

  const [grns, total] = await prisma.$transaction([
    prisma.gRN.findMany({
      where,
      include: {
        po: { select: { po_number: true, vendor: { select: { vendor_name: true } } } },
        items: { include: { po_item: true } },
      },
      orderBy: { created_at: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.gRN.count({ where }),
  ]);

  return { data: grns, pagination: { page, limit, total, pages: Math.ceil(total / limit) } };
}

// ── Get one ───────────────────────────────────────────────────────────────

export async function getGrnById(id: string) {
  const grn = await prisma.gRN.findUnique({
    where: { id },
    include: {
      po: { include: { vendor: true, items: true } },
      items: { include: { po_item: true } },
    },
  });
  if (!grn) throw Object.assign(new Error('GRN not found'), { statusCode: 404 });
  return grn;
}

// ── Create (DRAFT) ───────────────────────────────────────────────────────
//
// PO must be ISSUED. We deliberately do NOT block creating a new GRN just
// because earlier GRNs already exist against this PO — multiple partial
// deliveries against one PO are expected and fine; fulfillment is computed,
// not gated, at this stage.

export async function createGrn(input: CreateGRNInput) {
  if (!input.items?.length) {
    throw Object.assign(new Error('At least one item must be received'), { statusCode: 400 });
  }

  const po = await prisma.purchaseOrder.findUnique({
    where: { id: input.po_id },
    include: { items: true },
  });
  if (!po) throw Object.assign(new Error('Purchase order not found'), { statusCode: 404 });

  if (po.status !== POStatus.issued) {
    throw Object.assign(
      new Error('Purchase order must be ISSUED before recording a GRN'),
      { statusCode: 409 },
    );
  }

  // Every po_item_id referenced must actually belong to this PO.
  const poItemIds = new Set(po.items.map((i) => i.id));
  for (const item of input.items) {
    if (!poItemIds.has(item.po_item_id)) {
      throw Object.assign(
        new Error(`Item ${item.po_item_id} does not belong to PO ${po.po_number}`),
        { statusCode: 409 },
      );
    }
    if (item.quantity_received <= 0) {
      throw Object.assign(
        new Error('Quantity received must be greater than 0'),
        { statusCode: 400 },
      );
    }
  }

  const grn_number = await generateDocumentNumber(prisma, 'GRN');

  return prisma.gRN.create({
    data: {
      grn_number,
      po_id: input.po_id,
      status: GRNStatus.draft,
      received_by: input.received_by,
      received_at: input.received_at ?? new Date(),
      notes: input.notes,
      items: {
        create: input.items.map((item) => ({
          po_item_id: item.po_item_id,
          description:
            po.items.find((pi) => pi.id === item.po_item_id)?.description ?? '',
          quantity_received: new Prisma.Decimal(item.quantity_received),
          notes: item.notes,
        })),
      },
    },
    include: {
      items: { include: { po_item: true } },
      po: { select: { po_number: true } },
    },
  });
}

// ── Confirm (DRAFT → CONFIRMED, locks quantities, unlocks matching) ─────
//
// Once confirmed, this GRN's quantities are final and become visible to
// the 3-way match engine. There is no "post"/"received" intermediate —
// confirm is the single transition that locks a GRN.

export async function confirmGrn(id: string) {
  const grn = await prisma.gRN.findUnique({ where: { id } });
  if (!grn) throw Object.assign(new Error('GRN not found'), { statusCode: 404 });

  if (grn.status === GRNStatus.confirmed) {
    throw Object.assign(new Error('GRN is already confirmed'), { statusCode: 409 });
  }

  return prisma.gRN.update({
    where: { id },
    data: { status: GRNStatus.confirmed },
    include: { items: true },
  });
}