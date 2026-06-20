# FinOps
Financial Operations Platform
# FinOps Platform — Financial Operations Platform

> Evolved from a working Invoice Generator into a unified procurement and accounts management platform. Demonstrates a complete procurement lifecycle — from requisition to payment — with automated 3-way matching as the central feature.


**Repo:** https://github.com/ShubhAgarwal-03/FinOps

> ⚠️ API hosted on Render free tier — first request may take 30–60 seconds (cold start).

---

## 1. Purpose & Problem Statement

Enterprise procurement is a fragmented, largely manual process. Purchase orders, delivery records, and invoices live in separate systems with no automated validation between them. This leads to overpayments, duplicate invoices, delayed approvals, and disputes that take days to resolve.

This platform demonstrates a unified procurement workflow that:
- Guides a transaction from initial request through to payment
- Automatically validates that what was **ordered**, **delivered**, and **billed** all match
- Surfaces mismatches immediately with a structured resolution path

**Goal:** Prove that the core workflow — Requisition → PO → GRN → Vendor Invoice → 3-Way Match → Finance Approval → Payment — works correctly, end-to-end, in a single web application.

---

## 2. What We Built

### Two Complete Financial Domains

**Accounts Receivable (AR) — money coming in**
```
Customer → Sales Invoice → Payment Recording → Customer Ledger
```

**Accounts Payable (AP) — money going out**
```
Requisition → Approval → RFP → Vendor Quotes → Vendor Selection
→ Purchase Order (locked on issue) → GRN → Vendor Invoice
→ 3-Way Match → Dispute Resolution (if mismatch)
→ Finance Approval → Vendor Payment → Vendor Ledger
```

### Single-User Simulation
No authentication, no RBAC. The same user simulates Consumer, Manager, Procurement, Warehouse, Vendor, and Finance. This is intentional — the goal is validating **workflow correctness**, not access control.

---

## 3. Technology Stack

| Layer | Technology | Reason |
|---|---|---|
| Monorepo | Nx | Shared TypeScript types and validation between frontend and backend |
| Frontend | Next.js 16 (App Router) + TypeScript | Industry-standard React framework, file-based routing |
| UI | shadcn/ui + Tailwind CSS | Production-quality accessible components, no custom CSS needed |
| Backend | Node.js + Express + TypeScript | Lightweight REST API, fast to iterate |
| Database | PostgreSQL | Relational — enforces FK constraints between requisition, PO, GRN, invoice at DB level |
| ORM | Prisma | Type-safe DB access, migration management |
| Validation | Zod | Shared schemas between frontend and backend |
| PDF | PDFKit | Server-side PDF streaming |
| Charts | Recharts | Dashboard revenue visualisation |

**Why PostgreSQL over MongoDB:** Procurement records are highly relational. A requisition creates a PO, a PO links to a GRN, a GRN links to a vendor invoice. PostgreSQL enforces these relationships at the database level, preventing orphaned records and guaranteeing data integrity that a document store cannot.

---

## 4. Architecture

### Design Principle
> *"Separate business domains built on top of shared financial primitives."*

Sales Invoices (AR) and Vendor Invoices (AP) are **fully separate domain models** — no `invoice_type` discriminator column. Shared logic lives in `libs/shared/` and is consumed by both domains.

### System Layers
```
┌──────────────────────────────────────────────────────────────┐
│  Presentation Layer                                          │
│  Next.js App Router · shadcn/ui · Progressive workflow UI    │
├──────────────────────────────────────────────────────────────┤
│  API Layer                                                   │
│  Express + TypeScript · REST · Zod request validation        │
├──────────────────────────────────────────────────────────────┤
│  Domain Service Layer                                        │
│  libs/ar  ·  libs/ap  ·  libs/shared (financial engines)    │
├──────────────────────────────────────────────────────────────┤
│  Data Access Layer                                           │
│  Prisma ORM · PostgreSQL transactions · FK constraints       │
└──────────────────────────────────────────────────────────────┘
```

### Monorepo Structure
```
finops-platform/
├── apps/
│   ├── web/                          # Next.js 16 frontend
│   └── api/src/
│       ├── routes/
│       │   ├── ar/                   # customers, invoices, payments
│       │   └── ap/                   # vendors, requisitions, rfp,
│       │                             # purchase-orders, grn,
│       │                             # vendor-invoices, match,
│       │                             # disputes, vendor-payments
│       ├── middleware/
│       │   ├── error-handler.ts
│       │   ├── validate.ts           # Zod request validation wrapper
│       │   └── po-immutability.ts    # blocks writes to locked POs
│       └── config/prisma.ts
│
├── libs/
│   ├── shared/                       # Financial primitives — both domains consume
│   │   ├── engines/
│   │   │   ├── gst/                  # CGST/SGST/IGST split logic
│   │   │   ├── totals/               # subtotal, discount, tax, grand total
│   │   │   ├── payment-status/       # UNPAID / PARTIAL / PAID engine
│   │   │   └── ledger/               # double-entry balance calculation
│   │   ├── utils/
│   │   │   ├── sequential-numbering.ts  # INV-000001, PO-000001, GRN-000001
│   │   │   ├── snapshot.utils.ts        # entity → JSONB snapshot serialiser
│   │   │   ├── currency.utils.ts        # formatCurrency, numberToWords (crore/lakh)
│   │   │   └── round.utils.ts           # banker's rounding for tax
│   │   └── pdf/                      # PDFKit base layout — shared by AR + AP
│   │
│   ├── ar/                           # Accounts Receivable domain
│   │   ├── customers/                # customer.service + customer-ledger.service
│   │   ├── invoices/                 # invoice.service + invoice-pdf.service
│   │   └── payments/                 # payment.service + syncInvoicePaymentFields
│   │
│   └── ap/                           # Accounts Payable domain
│       ├── vendors/                  # vendor.service + vendor-ledger
│       ├── requisitions/             # requisition.service + status machine
│       ├── rfp/                      # rfp.service + quote submission + evaluation
│       ├── purchase-orders/          # po.service + po-amendment.service
│       ├── grn/                      # grn.service
│       ├── vendor-invoices/          # vendor-invoice.service
│       ├── match-engine/             # 3-way match algorithm ← core feature
│       ├── disputes/                 # dispute.service + resolution paths
│       └── vendor-payments/          # vendor-payment.service (gated by match)
│
└── prisma/
    ├── schema.prisma                 # single source of truth — all tables
    └── migrations/
```

---

## 5. Full Procurement Workflow

Each step is enforced in code — a step cannot proceed until the previous one is complete.

| Step | Actor | Action | System Behaviour |
|---|---|---|---|
| 1 | Consumer | Raises Requisition | Created with status `draft` |
| 2 | Manager | Approves or Rejects | `draft → submitted → approved / rejected` |
| 3 | Procurement | Creates RFP | Only allowed on `approved` requisition; requisition moves to `converted_to_rfp` |
| 4 | Vendors | Submit Quotes | Recorded against RFP; evaluated with scoring |
| 5 | Procurement | Selects Vendor | RFP moves to `awarded`; winning quote marked `is_selected` |
| 6 | Procurement | Generates PO | Created in `draft`; vendor snapshot frozen at creation time |
| 7 | Procurement | Issues PO | PO moves to `issued`; `issued_at` timestamp set; **direct edits now prohibited** |
| 8 | Warehouse | Records GRN | Actual received quantities logged per PO line item; GRN `posted` to lock it |
| 9 | Vendor | Submits Invoice | Vendor invoice created linked to PO + GRN; items must reference PO line items |
| 10 | System | Runs 3-Way Match | Automated — compares PO qty, GRN qty, Invoice qty per line item |
| 11 | Procurement | Resolves Dispute | If mismatch — identifies responsible party, takes corrective action |
| 12 | Finance | Approves Invoice | Only allowed on `matched` invoices; blocks payment otherwise |
| 13 | Finance | Records Payment | Gated — blocked until invoice is `approved` and match passed |
| 14 | System | Closes Transaction | Invoice moves to `paid`; vendor ledger updated |

---

## 6. Core Feature — 3-Way Matching

The central value proposition. Answers one question:

> **"Did we order it, receive it, and get billed for exactly the same quantity?"**

### How It Works

The match engine (`libs/ap/match-engine/match.engine.ts`) compares three quantities per line item:

| Source | Document | Field |
|---|---|---|
| What was ordered | Purchase Order | `po_items.quantity` |
| What was received | Goods Receipt Note | `grn_items.quantity_received` |
| What was billed | Vendor Invoice | `vendor_invoice_items.quantity` |

**MVP rule: exact equality only.** No tolerance bands.

### Match vs Mismatch — Example

| | PO Qty | GRN Qty | Invoice Qty | Result |
|---|---|---|---|---|
| Scenario A | 10 | 10 | 10 | ✅ MATCHED |
| Scenario B | 10 | 8 | 10 | ❌ MISMATCH — GRN received 8, vendor billed 10 |

In Scenario B the system immediately flags the discrepancy, blocks payment, and routes to dispute resolution. This prevents an overpayment for 2 units never delivered.

### Match Algorithm (line-item level)

```typescript
// libs/ap/match-engine/match.engine.ts — computeMatch()
for each PO line item:
  po_qty      = po_items[i].quantity
  grn_qty     = grn_items.find(po_item_id).quantity_received  (0 if missing)
  invoice_qty = vendor_invoice_items.find(po_item_id).quantity (0 if missing)

  is_matched = (po_qty === grn_qty) && (grn_qty === invoice_qty)

overall_matched = every line item is_matched
```

Overall result is `MATCHED` only if **every** line item matches. One mismatch fails the whole invoice.

### Payment Gates (enforced in vendor-payment.service.ts)
1. **Gate 1 — Finance approval:** Invoice status must be `approved`
2. **Gate 2 — Match result:** `match_result.overall_matched` must be `true`

Both gates must pass. Either alone is insufficient.

---

## 7. Dispute Resolution

When a mismatch is detected, invoice moves to `disputed` status and a dispute record is raised.

| Responsible Party | Root Cause | Corrective Action |
|---|---|---|
| Vendor | Wrong invoice quantity | Vendor corrects and resubmits invoice |
| Procurement | PO had incorrect quantity | Raise PO Amendment (original PO never edited) |
| Warehouse | GRN count error | Correct GRN quantity |

After correction, the 3-way match is re-run. This loop continues until all line items align.

**Resolution actions available:**
- `accept_invoice` — treat as matched, advance to finance approval
- `request_credit_note` — leave in disputed, await vendor correction
- `amend_po` — leave in disputed, raise PO amendment first
- `reject_invoice` — cancel the invoice

---

## 8. PO Immutability — Key Design Decision

Once a Purchase Order is issued (`issued_at` is set):
- Direct edits are **blocked at middleware level** (`po-immutability.ts`)
- Direct edits are **blocked at service level** (`po.service.ts`)
- All corrections go through `po_amendments` — append-only, each with reason + amended_by

This preserves a complete, tamper-proof audit trail.

```
POST /api/ap/purchase-orders/:id/issue      → locks the PO
PUT  /api/ap/purchase-orders/:id            → blocked after lock (409)
POST /api/ap/purchase-orders/:id/amendments → always allowed, append-only
```

---

## 9. Procurement State Machines

```
Requisition:
  draft → submitted → approved → converted_to_rfp
                    ↘ rejected

RFP:
  open → closed → awarded

Purchase Order:
  draft → issued → amended → closed
                ↘ cancelled
  (no direct edits after issued)

GRN:
  received → posted

Vendor Invoice:
  draft → submitted → matched ──→ approved → paid
                    ↘ disputed → (resolve) → matched
                                           ↘ cancelled

Dispute:
  open → resolved
```

---

## 10. Database Schema

### AR Tables
| Table | Purpose |
|---|---|
| `customers` | Contact + billing profile, GSTIN, PAN, currency |
| `sales_invoices` | Invoice with frozen `customer_snapshot` JSONB |
| `sales_invoice_items` | Line items with `tax_lines` JSONB array |
| `sales_payments` | Partial payment records |
| `customer_ledger` | `INVOICE_RAISED` / `PAYMENT_RECEIVED` entries with running balance |

### AP Tables
| Table | Purpose |
|---|---|
| `vendors` | Vendor directory, GSTIN, PAN, bank details |
| `requisitions` + `requisition_items` | Internal purchase requests |
| `rfps` + `vendor_quotes` + `quote_evaluations` | RFP process and vendor scoring |
| `purchase_orders` + `po_items` | Immutable after `issued_at` |
| `po_amendments` | Append-only correction records |
| `grns` + `grn_items` | Actual received quantities per PO line item |
| `vendor_invoices` + `vendor_invoice_items` | Separate from sales invoices — linked to PO + GRN |
| `match_results` + `match_result_items` | 3-way match output at line-item level |
| `dispute_records` | Raised on mismatch, resolved with action |
| `vendor_payments` | Gated by match + finance approval |
| `vendor_ledger` | `INVOICE_RECEIVED` / `PAYMENT_MADE` entries |

### Shared
| Table | Purpose |
|---|---|
| `items` | Reusable catalogue — HSN/SAC, tax rate, unit of measure |
| `company_settings` | Singleton — business identity, GSTIN, bank details for PDFs |

---

## 11. UI Structure

Built with shadcn/ui. Progressive disclosure — each workflow step unlocks only after the previous one completes. Users only see the next valid action.

| Screen | Key Components |
|---|---|
| Requisition | Form (item, qty), Badge (status), Button (Approve / Reject) |
| RFP + Quotes | Table (vendor responses), Dialog (evaluation notes), Button (select vendor) |
| Purchase Order | Read-only card (auto-populated from RFP), Button (issue / lock PO) |
| PO Amendments | Append-only list, Form (reason + description) |
| GRN | Form (received qty per line), Button (post GRN) |
| Vendor Invoice | Form (invoice qty, amount), Button (submit + trigger match) |
| Match Result | Alert (MATCHED ✅ / MISMATCH ❌), Table (PO qty \| GRN qty \| Invoice qty per line) |
| Dispute | Select (responsible party), Form (correction), Button (re-run match) |
| Finance Approval | Button (Approve / Reject / Hold) — visible only on `matched` invoices |
| Vendor Payment | Form (amount, method) — disabled with reason until `approved` + matched |
| AR Dashboard | KPI cards, revenue bar chart (6 months), top customers |
| Sales Invoices | Full CRUD, filters, PDF export, payment recording |
| Customer Ledger | Chronological entries, running balance, statement PDF |

---

## 12. AR Features (Fully Working)

- **Dashboard** — total revenue, revenue this month, outstanding receivables, overdue amount + count, invoice status counts, 6-month revenue bar chart, top 5 customers by invoiced amount
- **Customers** — CRUD, GSTIN/PAN, auto-currency from country, customer ledger, statement PDF
- **Sales Invoices** — multiple line items, per-item GST (IGST/CGST/SGST), discounts, sequential numbering (INV-000001), customer snapshot (historical invoices unaffected by customer edits), duplicate, soft delete, filter by status/date/search, pagination
- **Payments** — partial payments, multiple payments per invoice, overpayment guard, Mark as Paid shortcut, auto-sync `amount_paid` / `balance_due` / `payment_status`
- **PDF Export** — company header, GSTIN/PAN, bill-to/ship-to, HSN/SAC column, IGST/CGST/SGST breakdown, amount in words (crore/lakh/paise), bank details, authorized signatory

---

## 13. MVP Success Criteria

This MVP is successful if:

- [x] A complete procurement transaction can be demonstrated end-to-end
- [x] The workflow runs without manual workarounds
- [x] The 3-way match correctly detects deliberate mismatches
- [x] Dispute resolution allows correction based on responsible party
- [x] Purchase Orders are corrected through amendments, never direct edits
- [x] Finance approval blocks payment until approved
- [x] UI is guided, progressive, and built with shadcn/ui

---

## 14. What Is Explicitly Out of Scope (Phase 2)

| Excluded from MVP | Phase 2 |
|---|---|
| Authentication / login | JWT auth with role separation |
| Role-based access control | Approval workflows with notifications |
| Email / in-app notifications | Vendor self-service portal |
| Vendor portal | Analytics: match rates, dispute frequency |
| Reporting dashboards | Audit log and change history |
| Multi-currency conversion | Partial delivery tolerance bands |
| Tolerance bands in matching | SAP / Oracle ERP connector |
| Recurring invoices | — |

---

## 15. Running Locally

```bash
# Install dependencies
npm install

# Environment variables
cp .env.example .env
# Set DATABASE_URL (PostgreSQL) and FRONTEND_URL

# Database setup
npx prisma generate
npx prisma migrate dev

# Run API (port 3333)
npx nx serve api

# Run frontend (port 4200)
npx nx serve web
```

### Environment Variables
```
DATABASE_URL=postgresql://user:password@localhost:5432/finops
FRONTEND_URL=http://localhost:4200
NODE_ENV=development
```
