-- AlterEnum
ALTER TYPE "InvoiceStatus" ADD VALUE 'APPROVED';

-- AlterTable
ALTER TABLE "invoices" ADD COLUMN     "convertedToInvoiceId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "invoices_convertedToInvoiceId_key" ON "invoices"("convertedToInvoiceId");

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_convertedToInvoiceId_fkey" FOREIGN KEY ("convertedToInvoiceId") REFERENCES "invoices"("id") ON DELETE SET NULL ON UPDATE CASCADE;
