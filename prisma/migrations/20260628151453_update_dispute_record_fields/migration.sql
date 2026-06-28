/*
  Warnings:

  - You are about to drop the column `description` on the `dispute_records` table. All the data in the column will be lost.
  - You are about to drop the column `mismatch_detail` on the `dispute_records` table. All the data in the column will be lost.
  - You are about to drop the column `resolution_notes` on the `dispute_records` table. All the data in the column will be lost.
  - Added the required column `reason` to the `dispute_records` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "dispute_records" DROP COLUMN "description",
DROP COLUMN "mismatch_detail",
DROP COLUMN "resolution_notes",
ADD COLUMN     "raisedBy" TEXT,
ADD COLUMN     "reason" TEXT NOT NULL,
ADD COLUMN     "resolution" TEXT,
ADD COLUMN     "resolution_action" TEXT,
ADD COLUMN     "resolved_by" TEXT;
