import { Prisma, RequisitionStatus } from '@prisma/client';
import { prisma } from '../../../apps/api/src/config/prisma';
import { generateDocumentNumber } from '../../shared/utils/sequential-numbering';

export interface RequisitionItemInput {
  item_id?: string;
  description: string;
  quantity: number;
  unit_of_measure?: string;
  estimated_unit_price?: number;
  notes?: string;
  sort_order?: number;
}

export interface CreateRequisitionInput {
  title: string;
  description?: string;
  requested_by?: string;
  required_by?: Date;
  items: RequisitionItemInput[];
}

export interface UpdateRequisitionInput extends Partial<CreateRequisitionInput> {}

// Valid status transitions
const TRANSITIONS: Record<string, RequisitionStatus[]> = {
  draft:             ['submitted'],
  submitted:         ['approved', 'rejected'],
  approved:          ['converted_to_rfp'],
  rejected:          [],
  converted_to_rfp:  [],
};

export async function listRequisitions(query: {
  status?: string; search?: string; page?: string; limit?: string;
}) {
  const page  = Math.max(1, parseInt(query.page  ?? '1',  10));
  const limit = Math.min(50, parseInt(query.limit ?? '20', 10));

  const where: Prisma.RequisitionWhereInput = {
    ...(query.status && { status: query.status as RequisitionStatus }),
    ...(query.search && {
      OR: [
        { title:      { contains: query.search, mode: 'insensitive' } },
        { req_number: { contains: query.search, mode: 'insensitive' } },
      ],
    }),
  };

  const [requisitions, total] = await prisma.$transaction([
    prisma.requisition.findMany({
      where,
      include: { items: true },
      orderBy: { created_at: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.requisition.count({ where }),
  ]);

  return { requisitions, pagination: { page, limit, total, pages: Math.ceil(total / limit) } };
}

export async function getRequisitionById(id: string) {
  const req = await prisma.requisition.findUnique({
    where: { id },
    include: { items: { include: { item: true } }, rfps: true },
  });
  if (!req) throw Object.assign(new Error('Requisition not found'), { statusCode: 404 });
  return req;
}

export async function createRequisition(input: CreateRequisitionInput) {
  if (!input.items?.length) {
    throw Object.assign(new Error('At least one item is required'), { statusCode: 400 });
  }

  const req_number = await generateDocumentNumber(prisma, 'REQ');

  return prisma.requisition.create({
    data: {
      req_number,
      title:        input.title,
      description:  input.description,
      requested_by: input.requested_by,
      required_by:  input.required_by,
      status:       RequisitionStatus.draft,
      items: {
        create: input.items.map((item, idx) => ({
          item_id:              item.item_id ?? null,
          description:          item.description,
          quantity:             new Prisma.Decimal(item.quantity),
          unit_of_measure:      item.unit_of_measure,
          estimated_unit_price: item.estimated_unit_price
                                  ? new Prisma.Decimal(item.estimated_unit_price)
                                  : null,
          notes:      item.notes,
          sort_order: item.sort_order ?? idx,
        })),
      },
    },
    include: { items: true },
  });
}

export async function updateRequisition(id: string, input: UpdateRequisitionInput) {
  const existing = await prisma.requisition.findUnique({ where: { id } });
  if (!existing) throw Object.assign(new Error('Requisition not found'), { statusCode: 404 });

  if (existing.status !== RequisitionStatus.draft) {
    throw Object.assign(
      new Error('Cannot edit a requisition that is not in DRAFT status'),
      { statusCode: 409 }
    );
  }

  return prisma.$transaction(async (tx) => {
    if (input.items) {
      await tx.requisitionItem.deleteMany({ where: { requisition_id: id } });
      await tx.requisitionItem.createMany({
        data: input.items.map((item, idx) => ({
          requisition_id:       id,
          item_id:              item.item_id ?? null,
          description:          item.description,
          quantity:             new Prisma.Decimal(item.quantity),
          unit_of_measure:      item.unit_of_measure,
          estimated_unit_price: item.estimated_unit_price
                                  ? new Prisma.Decimal(item.estimated_unit_price)
                                  : null,
          notes:      item.notes,
          sort_order: item.sort_order ?? idx,
        })),
      });
    }

    return tx.requisition.update({
      where: { id },
      data: {
        title:        input.title,
        description:  input.description,
        requested_by: input.requested_by,
        required_by:  input.required_by,
      },
      include: { items: true },
    });
  });
}

export async function transitionRequisitionStatus(
  id: string,
  newStatus: RequisitionStatus,
  meta?: { approved_by?: string; rejection_reason?: string }
) {
  const existing = await prisma.requisition.findUnique({ where: { id } });
  if (!existing) throw Object.assign(new Error('Requisition not found'), { statusCode: 404 });

  const allowed = TRANSITIONS[existing.status] ?? [];
  if (!allowed.includes(newStatus)) {
    throw Object.assign(
      new Error(`Invalid transition: ${existing.status} → ${newStatus}`),
      { statusCode: 409 }
    );
  }

  return prisma.requisition.update({
    where: { id },
    data: {
      status:           newStatus,
      approved_by:      newStatus === RequisitionStatus.approved ? (meta?.approved_by ?? 'Manager') : undefined,
      approved_at:      newStatus === RequisitionStatus.approved ? new Date() : undefined,
      rejection_reason: newStatus === RequisitionStatus.rejected  ? meta?.rejection_reason : undefined,
    },
    include: { items: true },
  });
}

export async function deleteRequisition(id: string) {
  const existing = await prisma.requisition.findUnique({ where: { id } });
  if (!existing) throw Object.assign(new Error('Requisition not found'), { statusCode: 404 });

  if (existing.status !== RequisitionStatus.draft) {
    throw Object.assign(
      new Error('Only DRAFT requisitions can be deleted'),
      { statusCode: 409 }
    );
  }

  return prisma.requisition.delete({ where: { id } });
}