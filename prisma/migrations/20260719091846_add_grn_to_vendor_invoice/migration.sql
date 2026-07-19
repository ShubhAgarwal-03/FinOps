/*
  Warnings:

  - Added the required column `grn_id` to the `vendor_invoices` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "vendor_invoices" ADD COLUMN     "grn_id" TEXT NOT NULL;

-- AddForeignKey
ALTER TABLE "vendor_invoices" ADD CONSTRAINT "vendor_invoices_grn_id_fkey" FOREIGN KEY ("grn_id") REFERENCES "grns"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
