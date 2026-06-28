-- CreateEnum
CREATE TYPE "PaymentMethod" AS ENUM ('cash', 'bank_transfer', 'upi', 'cheque', 'card', 'other');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('unpaid', 'partial', 'paid', 'overpaid');

-- CreateEnum
CREATE TYPE "CustomerType" AS ENUM ('individual', 'business');

-- CreateEnum
CREATE TYPE "LedgerDirection" AS ENUM ('DEBIT', 'CREDIT');

-- CreateEnum
CREATE TYPE "CustomerLedgerEntryType" AS ENUM ('INVOICE_RAISED', 'PAYMENT_RECEIVED', 'CREDIT_NOTE');

-- CreateEnum
CREATE TYPE "VendorLedgerEntryType" AS ENUM ('INVOICE_RECEIVED', 'PAYMENT_MADE', 'DEBIT_NOTE');

-- CreateEnum
CREATE TYPE "SalesInvoiceStatus" AS ENUM ('draft', 'sent', 'paid', 'void');

-- CreateEnum
CREATE TYPE "RequisitionStatus" AS ENUM ('draft', 'pending_approval', 'approved', 'rejected', 'converted_to_rfp');

-- CreateEnum
CREATE TYPE "RFPStatus" AS ENUM ('open', 'evaluating', 'vendor_selected', 'closed');

-- CreateEnum
CREATE TYPE "POStatus" AS ENUM ('draft', 'issued', 'partially_received', 'fully_received', 'closed', 'cancelled');

-- CreateEnum
CREATE TYPE "GRNStatus" AS ENUM ('draft', 'confirmed');

-- CreateEnum
CREATE TYPE "VendorInvoiceStatus" AS ENUM ('draft', 'submitted', 'matched', 'mismatched', 'disputed', 'approved', 'rejected', 'paid', 'void');

-- CreateEnum
CREATE TYPE "MatchStatus" AS ENUM ('matched', 'mismatched');

-- CreateEnum
CREATE TYPE "DisputeStatus" AS ENUM ('open', 'resolved_accept', 'resolved_reject', 'resolved_amend_po');

-- CreateEnum
CREATE TYPE "DisputeParty" AS ENUM ('vendor', 'internal', 'purchase_order');

-- CreateTable
CREATE TABLE "company_settings" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "address" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "logo_url" TEXT,
    "gstin" TEXT,
    "pan" TEXT,
    "bank_name" TEXT,
    "account_number" TEXT,
    "ifsc_code" TEXT,
    "branch" TEXT,
    "state" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "company_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "items" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "unit_price" DECIMAL(12,2) NOT NULL,
    "tax_percent" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "hsn_sac" TEXT,
    "unit_of_measure" TEXT,
    "item_type" TEXT NOT NULL DEFAULT 'simple',
    "currency" TEXT NOT NULL DEFAULT 'INR',
    "is_deleted" BOOLEAN NOT NULL DEFAULT false,
    "deleted_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "customers" (
    "id" TEXT NOT NULL,
    "customer_code" TEXT,
    "customer_type" "CustomerType" NOT NULL DEFAULT 'business',
    "customer_name" TEXT NOT NULL,
    "company_name" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "address" TEXT,
    "billing_address_1" TEXT,
    "billing_address_2" TEXT,
    "city" TEXT,
    "state" TEXT,
    "postal_code" TEXT,
    "country" TEXT NOT NULL DEFAULT 'IN',
    "currency" TEXT NOT NULL DEFAULT 'INR',
    "gstin" TEXT,
    "pan" TEXT,
    "registration_number" TEXT,
    "is_deleted" BOOLEAN NOT NULL DEFAULT false,
    "deleted_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "customers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sales_invoices" (
    "id" TEXT NOT NULL,
    "invoice_number" TEXT NOT NULL,
    "po_so_number" TEXT,
    "customer_id" TEXT NOT NULL,
    "customer_snapshot" JSONB NOT NULL,
    "status" "SalesInvoiceStatus" NOT NULL DEFAULT 'draft',
    "issue_date" TIMESTAMP(3) NOT NULL,
    "due_date" TIMESTAMP(3),
    "is_interstate" BOOLEAN NOT NULL DEFAULT true,
    "tax_exempt" BOOLEAN NOT NULL DEFAULT false,
    "subtotal" DECIMAL(12,2) NOT NULL,
    "discount_percent" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "discount_amount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "tax_total" DECIMAL(12,2) NOT NULL,
    "total" DECIMAL(12,2) NOT NULL,
    "amount_paid" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "balance_due" DECIMAL(12,2) NOT NULL,
    "payment_status" "PaymentStatus" NOT NULL DEFAULT 'unpaid',
    "shipping_address" TEXT,
    "notes" TEXT,
    "payment_terms" TEXT,
    "terms_and_conditions" TEXT,
    "is_deleted" BOOLEAN NOT NULL DEFAULT false,
    "deleted_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sales_invoices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sales_invoice_items" (
    "id" TEXT NOT NULL,
    "invoice_id" TEXT NOT NULL,
    "item_id" TEXT,
    "description" TEXT NOT NULL,
    "hsn_sac" TEXT,
    "quantity" DECIMAL(10,3) NOT NULL,
    "unit_price" DECIMAL(12,2) NOT NULL,
    "tax_lines" JSONB NOT NULL DEFAULT '[]',
    "line_total" DECIMAL(12,2) NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "sales_invoice_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sales_payments" (
    "id" TEXT NOT NULL,
    "invoice_id" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "method" "PaymentMethod" NOT NULL,
    "paid_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sales_payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "customer_ledger" (
    "id" TEXT NOT NULL,
    "customer_id" TEXT NOT NULL,
    "sales_invoice_id" TEXT,
    "entry_type" "CustomerLedgerEntryType" NOT NULL,
    "direction" "LedgerDirection" NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "description" TEXT NOT NULL,
    "reference_number" TEXT,
    "entry_date" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "customer_ledger_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vendors" (
    "id" TEXT NOT NULL,
    "vendor_code" TEXT,
    "vendor_name" TEXT NOT NULL,
    "company_name" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "address" TEXT,
    "billing_address_1" TEXT,
    "billing_address_2" TEXT,
    "city" TEXT,
    "state" TEXT,
    "postal_code" TEXT,
    "country" TEXT NOT NULL DEFAULT 'IN',
    "currency" TEXT NOT NULL DEFAULT 'INR',
    "gstin" TEXT,
    "pan" TEXT,
    "payment_terms" TEXT,
    "is_deleted" BOOLEAN NOT NULL DEFAULT false,
    "deleted_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "vendors_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "requisitions" (
    "id" TEXT NOT NULL,
    "req_number" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "status" "RequisitionStatus" NOT NULL DEFAULT 'draft',
    "requested_by" TEXT,
    "approved_by" TEXT,
    "approved_at" TIMESTAMP(3),
    "rejection_reason" TEXT,
    "required_by" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "requisitions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "requisition_items" (
    "id" TEXT NOT NULL,
    "requisition_id" TEXT NOT NULL,
    "item_id" TEXT,
    "description" TEXT NOT NULL,
    "quantity" DECIMAL(10,3) NOT NULL,
    "unit_of_measure" TEXT,
    "estimated_unit_price" DECIMAL(12,2),
    "notes" TEXT,
    "sort_order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "requisition_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rfps" (
    "id" TEXT NOT NULL,
    "rfp_number" TEXT NOT NULL,
    "requisition_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "status" "RFPStatus" NOT NULL DEFAULT 'open',
    "deadline" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "rfps_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vendor_quotes" (
    "id" TEXT NOT NULL,
    "rfp_id" TEXT NOT NULL,
    "vendor_id" TEXT NOT NULL,
    "unit_price" DECIMAL(12,2) NOT NULL,
    "total_amount" DECIMAL(12,2) NOT NULL,
    "lead_time_days" INTEGER,
    "validity_days" INTEGER,
    "notes" TEXT,
    "submitted_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "vendor_quotes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "quote_evaluations" (
    "id" TEXT NOT NULL,
    "rfp_id" TEXT NOT NULL,
    "vendor_quote_id" TEXT NOT NULL,
    "score" INTEGER,
    "price_score" INTEGER,
    "quality_score" INTEGER,
    "lead_time_score" INTEGER,
    "notes" TEXT,
    "is_selected" BOOLEAN NOT NULL DEFAULT false,
    "selected_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "quote_evaluations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "purchase_orders" (
    "id" TEXT NOT NULL,
    "po_number" TEXT NOT NULL,
    "vendor_id" TEXT NOT NULL,
    "vendor_snapshot" JSONB NOT NULL,
    "rfp_id" TEXT,
    "status" "POStatus" NOT NULL DEFAULT 'draft',
    "is_interstate" BOOLEAN NOT NULL DEFAULT true,
    "subtotal" DECIMAL(12,2) NOT NULL,
    "discount_percent" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "discount_amount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "tax_total" DECIMAL(12,2) NOT NULL,
    "total" DECIMAL(12,2) NOT NULL,
    "notes" TEXT,
    "payment_terms" TEXT,
    "delivery_address" TEXT,
    "issued_at" TIMESTAMP(3),
    "expected_delivery" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "purchase_orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "po_items" (
    "id" TEXT NOT NULL,
    "po_id" TEXT NOT NULL,
    "item_id" TEXT,
    "description" TEXT NOT NULL,
    "hsn_sac" TEXT,
    "quantity" DECIMAL(10,3) NOT NULL,
    "unit_price" DECIMAL(12,2) NOT NULL,
    "tax_lines" JSONB NOT NULL DEFAULT '[]',
    "line_total" DECIMAL(12,2) NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "po_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "po_amendments" (
    "id" TEXT NOT NULL,
    "po_id" TEXT NOT NULL,
    "amendment_number" INTEGER NOT NULL,
    "reason" TEXT NOT NULL,
    "changes" JSONB NOT NULL,
    "amended_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "po_amendments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "grns" (
    "id" TEXT NOT NULL,
    "grn_number" TEXT NOT NULL,
    "po_id" TEXT NOT NULL,
    "status" "GRNStatus" NOT NULL DEFAULT 'draft',
    "received_by" TEXT,
    "received_at" TIMESTAMP(3),
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "grns_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "grn_items" (
    "id" TEXT NOT NULL,
    "grn_id" TEXT NOT NULL,
    "po_item_id" TEXT NOT NULL,
    "item_id" TEXT,
    "description" TEXT NOT NULL,
    "quantity_received" DECIMAL(10,3) NOT NULL,
    "notes" TEXT,
    "sort_order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "grn_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vendor_invoices" (
    "id" TEXT NOT NULL,
    "invoice_number" TEXT NOT NULL,
    "po_id" TEXT NOT NULL,
    "vendor_id" TEXT NOT NULL,
    "vendor_snapshot" JSONB NOT NULL,
    "status" "VendorInvoiceStatus" NOT NULL DEFAULT 'draft',
    "vendor_ref_number" TEXT,
    "issue_date" TIMESTAMP(3) NOT NULL,
    "due_date" TIMESTAMP(3),
    "is_interstate" BOOLEAN NOT NULL DEFAULT true,
    "subtotal" DECIMAL(12,2) NOT NULL,
    "discount_percent" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "discount_amount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "tax_total" DECIMAL(12,2) NOT NULL,
    "total" DECIMAL(12,2) NOT NULL,
    "amount_paid" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "balance_due" DECIMAL(12,2) NOT NULL,
    "payment_status" "PaymentStatus" NOT NULL DEFAULT 'unpaid',
    "notes" TEXT,
    "approved_by" TEXT,
    "approved_at" TIMESTAMP(3),
    "rejection_reason" TEXT,
    "is_deleted" BOOLEAN NOT NULL DEFAULT false,
    "deleted_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "vendor_invoices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vendor_invoice_items" (
    "id" TEXT NOT NULL,
    "vendor_invoice_id" TEXT NOT NULL,
    "po_item_id" TEXT NOT NULL,
    "item_id" TEXT,
    "description" TEXT NOT NULL,
    "hsn_sac" TEXT,
    "quantity_billed" DECIMAL(10,3) NOT NULL,
    "unit_price" DECIMAL(12,2) NOT NULL,
    "tax_lines" JSONB NOT NULL DEFAULT '[]',
    "line_total" DECIMAL(12,2) NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "vendor_invoice_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "match_results" (
    "id" TEXT NOT NULL,
    "vendor_invoice_id" TEXT NOT NULL,
    "grn_id" TEXT NOT NULL,
    "status" "MatchStatus" NOT NULL,
    "line_item_results" JSONB NOT NULL,
    "matched_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "match_results_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dispute_records" (
    "id" TEXT NOT NULL,
    "vendor_invoice_id" TEXT NOT NULL,
    "status" "DisputeStatus" NOT NULL DEFAULT 'open',
    "responsible_party" "DisputeParty" NOT NULL,
    "description" TEXT NOT NULL,
    "mismatch_detail" JSONB NOT NULL,
    "resolution_notes" TEXT,
    "resolved_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "dispute_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vendor_payments" (
    "id" TEXT NOT NULL,
    "payment_ref" TEXT NOT NULL,
    "vendor_invoice_id" TEXT NOT NULL,
    "vendor_id" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "method" "PaymentMethod" NOT NULL,
    "paid_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "vendor_payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vendor_ledger" (
    "id" TEXT NOT NULL,
    "vendor_id" TEXT NOT NULL,
    "vendor_invoice_id" TEXT,
    "vendor_payment_id" TEXT,
    "entry_type" "VendorLedgerEntryType" NOT NULL,
    "direction" "LedgerDirection" NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "description" TEXT NOT NULL,
    "reference_number" TEXT,
    "entry_date" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "vendor_ledger_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "items_is_deleted_idx" ON "items"("is_deleted");

-- CreateIndex
CREATE INDEX "customers_is_deleted_idx" ON "customers"("is_deleted");

-- CreateIndex
CREATE INDEX "customers_customer_name_idx" ON "customers"("customer_name");

-- CreateIndex
CREATE UNIQUE INDEX "sales_invoices_invoice_number_key" ON "sales_invoices"("invoice_number");

-- CreateIndex
CREATE INDEX "sales_invoices_customer_id_idx" ON "sales_invoices"("customer_id");

-- CreateIndex
CREATE INDEX "sales_invoices_status_idx" ON "sales_invoices"("status");

-- CreateIndex
CREATE INDEX "sales_invoices_payment_status_idx" ON "sales_invoices"("payment_status");

-- CreateIndex
CREATE INDEX "sales_invoices_issue_date_idx" ON "sales_invoices"("issue_date");

-- CreateIndex
CREATE INDEX "sales_invoices_is_deleted_idx" ON "sales_invoices"("is_deleted");

-- CreateIndex
CREATE INDEX "sales_invoice_items_invoice_id_idx" ON "sales_invoice_items"("invoice_id");

-- CreateIndex
CREATE INDEX "sales_payments_invoice_id_idx" ON "sales_payments"("invoice_id");

-- CreateIndex
CREATE INDEX "customer_ledger_customer_id_idx" ON "customer_ledger"("customer_id");

-- CreateIndex
CREATE INDEX "customer_ledger_entry_date_idx" ON "customer_ledger"("entry_date");

-- CreateIndex
CREATE INDEX "vendors_is_deleted_idx" ON "vendors"("is_deleted");

-- CreateIndex
CREATE INDEX "vendors_vendor_name_idx" ON "vendors"("vendor_name");

-- CreateIndex
CREATE UNIQUE INDEX "requisitions_req_number_key" ON "requisitions"("req_number");

-- CreateIndex
CREATE INDEX "requisitions_status_idx" ON "requisitions"("status");

-- CreateIndex
CREATE INDEX "requisition_items_requisition_id_idx" ON "requisition_items"("requisition_id");

-- CreateIndex
CREATE UNIQUE INDEX "rfps_rfp_number_key" ON "rfps"("rfp_number");

-- CreateIndex
CREATE INDEX "rfps_requisition_id_idx" ON "rfps"("requisition_id");

-- CreateIndex
CREATE INDEX "rfps_status_idx" ON "rfps"("status");

-- CreateIndex
CREATE INDEX "vendor_quotes_rfp_id_idx" ON "vendor_quotes"("rfp_id");

-- CreateIndex
CREATE UNIQUE INDEX "vendor_quotes_rfp_id_vendor_id_key" ON "vendor_quotes"("rfp_id", "vendor_id");

-- CreateIndex
CREATE UNIQUE INDEX "quote_evaluations_vendor_quote_id_key" ON "quote_evaluations"("vendor_quote_id");

-- CreateIndex
CREATE INDEX "quote_evaluations_rfp_id_idx" ON "quote_evaluations"("rfp_id");

-- CreateIndex
CREATE UNIQUE INDEX "purchase_orders_po_number_key" ON "purchase_orders"("po_number");

-- CreateIndex
CREATE INDEX "purchase_orders_vendor_id_idx" ON "purchase_orders"("vendor_id");

-- CreateIndex
CREATE INDEX "purchase_orders_status_idx" ON "purchase_orders"("status");

-- CreateIndex
CREATE INDEX "purchase_orders_issued_at_idx" ON "purchase_orders"("issued_at");

-- CreateIndex
CREATE INDEX "po_items_po_id_idx" ON "po_items"("po_id");

-- CreateIndex
CREATE INDEX "po_amendments_po_id_idx" ON "po_amendments"("po_id");

-- CreateIndex
CREATE UNIQUE INDEX "po_amendments_po_id_amendment_number_key" ON "po_amendments"("po_id", "amendment_number");

-- CreateIndex
CREATE UNIQUE INDEX "grns_grn_number_key" ON "grns"("grn_number");

-- CreateIndex
CREATE INDEX "grns_po_id_idx" ON "grns"("po_id");

-- CreateIndex
CREATE INDEX "grns_status_idx" ON "grns"("status");

-- CreateIndex
CREATE INDEX "grn_items_grn_id_idx" ON "grn_items"("grn_id");

-- CreateIndex
CREATE INDEX "grn_items_po_item_id_idx" ON "grn_items"("po_item_id");

-- CreateIndex
CREATE UNIQUE INDEX "vendor_invoices_invoice_number_key" ON "vendor_invoices"("invoice_number");

-- CreateIndex
CREATE INDEX "vendor_invoices_po_id_idx" ON "vendor_invoices"("po_id");

-- CreateIndex
CREATE INDEX "vendor_invoices_vendor_id_idx" ON "vendor_invoices"("vendor_id");

-- CreateIndex
CREATE INDEX "vendor_invoices_status_idx" ON "vendor_invoices"("status");

-- CreateIndex
CREATE INDEX "vendor_invoices_is_deleted_idx" ON "vendor_invoices"("is_deleted");

-- CreateIndex
CREATE INDEX "vendor_invoice_items_vendor_invoice_id_idx" ON "vendor_invoice_items"("vendor_invoice_id");

-- CreateIndex
CREATE INDEX "vendor_invoice_items_po_item_id_idx" ON "vendor_invoice_items"("po_item_id");

-- CreateIndex
CREATE INDEX "match_results_vendor_invoice_id_idx" ON "match_results"("vendor_invoice_id");

-- CreateIndex
CREATE INDEX "match_results_grn_id_idx" ON "match_results"("grn_id");

-- CreateIndex
CREATE INDEX "match_results_status_idx" ON "match_results"("status");

-- CreateIndex
CREATE INDEX "dispute_records_vendor_invoice_id_idx" ON "dispute_records"("vendor_invoice_id");

-- CreateIndex
CREATE INDEX "dispute_records_status_idx" ON "dispute_records"("status");

-- CreateIndex
CREATE UNIQUE INDEX "vendor_payments_payment_ref_key" ON "vendor_payments"("payment_ref");

-- CreateIndex
CREATE INDEX "vendor_payments_vendor_invoice_id_idx" ON "vendor_payments"("vendor_invoice_id");

-- CreateIndex
CREATE INDEX "vendor_payments_vendor_id_idx" ON "vendor_payments"("vendor_id");

-- CreateIndex
CREATE INDEX "vendor_ledger_vendor_id_idx" ON "vendor_ledger"("vendor_id");

-- CreateIndex
CREATE INDEX "vendor_ledger_entry_date_idx" ON "vendor_ledger"("entry_date");

-- AddForeignKey
ALTER TABLE "sales_invoices" ADD CONSTRAINT "sales_invoices_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales_invoice_items" ADD CONSTRAINT "sales_invoice_items_invoice_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES "sales_invoices"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales_invoice_items" ADD CONSTRAINT "sales_invoice_items_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "items"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales_payments" ADD CONSTRAINT "sales_payments_invoice_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES "sales_invoices"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer_ledger" ADD CONSTRAINT "customer_ledger_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer_ledger" ADD CONSTRAINT "customer_ledger_sales_invoice_id_fkey" FOREIGN KEY ("sales_invoice_id") REFERENCES "sales_invoices"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "requisition_items" ADD CONSTRAINT "requisition_items_requisition_id_fkey" FOREIGN KEY ("requisition_id") REFERENCES "requisitions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "requisition_items" ADD CONSTRAINT "requisition_items_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "items"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rfps" ADD CONSTRAINT "rfps_requisition_id_fkey" FOREIGN KEY ("requisition_id") REFERENCES "requisitions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vendor_quotes" ADD CONSTRAINT "vendor_quotes_rfp_id_fkey" FOREIGN KEY ("rfp_id") REFERENCES "rfps"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vendor_quotes" ADD CONSTRAINT "vendor_quotes_vendor_id_fkey" FOREIGN KEY ("vendor_id") REFERENCES "vendors"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quote_evaluations" ADD CONSTRAINT "quote_evaluations_rfp_id_fkey" FOREIGN KEY ("rfp_id") REFERENCES "rfps"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quote_evaluations" ADD CONSTRAINT "quote_evaluations_vendor_quote_id_fkey" FOREIGN KEY ("vendor_quote_id") REFERENCES "vendor_quotes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_orders" ADD CONSTRAINT "purchase_orders_vendor_id_fkey" FOREIGN KEY ("vendor_id") REFERENCES "vendors"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_orders" ADD CONSTRAINT "purchase_orders_rfp_id_fkey" FOREIGN KEY ("rfp_id") REFERENCES "rfps"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "po_items" ADD CONSTRAINT "po_items_po_id_fkey" FOREIGN KEY ("po_id") REFERENCES "purchase_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "po_items" ADD CONSTRAINT "po_items_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "items"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "po_amendments" ADD CONSTRAINT "po_amendments_po_id_fkey" FOREIGN KEY ("po_id") REFERENCES "purchase_orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "grns" ADD CONSTRAINT "grns_po_id_fkey" FOREIGN KEY ("po_id") REFERENCES "purchase_orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "grn_items" ADD CONSTRAINT "grn_items_grn_id_fkey" FOREIGN KEY ("grn_id") REFERENCES "grns"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "grn_items" ADD CONSTRAINT "grn_items_po_item_id_fkey" FOREIGN KEY ("po_item_id") REFERENCES "po_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "grn_items" ADD CONSTRAINT "grn_items_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "items"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vendor_invoices" ADD CONSTRAINT "vendor_invoices_po_id_fkey" FOREIGN KEY ("po_id") REFERENCES "purchase_orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vendor_invoices" ADD CONSTRAINT "vendor_invoices_vendor_id_fkey" FOREIGN KEY ("vendor_id") REFERENCES "vendors"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vendor_invoice_items" ADD CONSTRAINT "vendor_invoice_items_vendor_invoice_id_fkey" FOREIGN KEY ("vendor_invoice_id") REFERENCES "vendor_invoices"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vendor_invoice_items" ADD CONSTRAINT "vendor_invoice_items_po_item_id_fkey" FOREIGN KEY ("po_item_id") REFERENCES "po_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vendor_invoice_items" ADD CONSTRAINT "vendor_invoice_items_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "items"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "match_results" ADD CONSTRAINT "match_results_vendor_invoice_id_fkey" FOREIGN KEY ("vendor_invoice_id") REFERENCES "vendor_invoices"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "match_results" ADD CONSTRAINT "match_results_grn_id_fkey" FOREIGN KEY ("grn_id") REFERENCES "grns"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dispute_records" ADD CONSTRAINT "dispute_records_vendor_invoice_id_fkey" FOREIGN KEY ("vendor_invoice_id") REFERENCES "vendor_invoices"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vendor_payments" ADD CONSTRAINT "vendor_payments_vendor_invoice_id_fkey" FOREIGN KEY ("vendor_invoice_id") REFERENCES "vendor_invoices"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vendor_payments" ADD CONSTRAINT "vendor_payments_vendor_id_fkey" FOREIGN KEY ("vendor_id") REFERENCES "vendors"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vendor_ledger" ADD CONSTRAINT "vendor_ledger_vendor_id_fkey" FOREIGN KEY ("vendor_id") REFERENCES "vendors"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vendor_ledger" ADD CONSTRAINT "vendor_ledger_vendor_invoice_id_fkey" FOREIGN KEY ("vendor_invoice_id") REFERENCES "vendor_invoices"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vendor_ledger" ADD CONSTRAINT "vendor_ledger_vendor_payment_id_fkey" FOREIGN KEY ("vendor_payment_id") REFERENCES "vendor_payments"("id") ON DELETE SET NULL ON UPDATE CASCADE;
