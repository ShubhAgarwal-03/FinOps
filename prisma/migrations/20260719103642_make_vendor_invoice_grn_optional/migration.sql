-- DropForeignKey
ALTER TABLE "vendor_invoices" DROP CONSTRAINT "vendor_invoices_grn_id_fkey";

-- AlterTable
ALTER TABLE "vendor_invoices" ALTER COLUMN "grn_id" DROP NOT NULL;

-- AddForeignKey
ALTER TABLE "vendor_invoices" ADD CONSTRAINT "vendor_invoices_grn_id_fkey" FOREIGN KEY ("grn_id") REFERENCES "grns"("id") ON DELETE SET NULL ON UPDATE CASCADE;
