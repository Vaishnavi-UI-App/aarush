-- AlterTable
ALTER TABLE "payments" ADD COLUMN     "batchId" TEXT;

-- CreateIndex
CREATE INDEX "payments_batchId_idx" ON "payments"("batchId");
