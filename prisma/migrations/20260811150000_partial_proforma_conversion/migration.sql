-- AlterEnum
ALTER TYPE "InvoiceStatus" ADD VALUE 'PARTIALLY_CONVERTED';

-- DropForeignKey
ALTER TABLE "invoices" DROP CONSTRAINT "invoices_convertedToInvoiceId_fkey";

-- DropIndex
DROP INDEX "invoices_convertedToInvoiceId_key";

-- AlterTable: add the new columns first, keeping the old convertedToInvoiceId column
-- around just long enough to migrate its existing non-null rows below.
ALTER TABLE "invoices" ADD COLUMN "proformaSourceId" TEXT;
ALTER TABLE "invoice_lines" ADD COLUMN "convertedToInvoiceId" TEXT;

-- Data migration: the old schema only supported a single 1:1 proforma->sale conversion
-- via invoices.convertedToInvoiceId. Preserve every existing conversion under the new
-- one-to-many model (Invoice.proformaSourceId + InvoiceLine.convertedToInvoiceId) purely
-- via a SQL join on the old column -- not hardcoded to any particular environment's row
-- IDs, so this works identically whether applied to dev or production data.
UPDATE "invoices" AS sale
SET "proformaSourceId" = proforma."id"
FROM "invoices" AS proforma
WHERE proforma."convertedToInvoiceId" = sale."id";

UPDATE "invoice_lines" AS il
SET "convertedToInvoiceId" = proforma."convertedToInvoiceId"
FROM "invoices" AS proforma
WHERE il."invoiceId" = proforma."id" AND proforma."convertedToInvoiceId" IS NOT NULL;

-- Now safe to drop the old 1:1 column.
ALTER TABLE "invoices" DROP COLUMN "convertedToInvoiceId";

-- CreateIndex
CREATE INDEX "invoices_proformaSourceId_idx" ON "invoices"("proformaSourceId");

-- CreateIndex
CREATE INDEX "invoice_lines_convertedToInvoiceId_idx" ON "invoice_lines"("convertedToInvoiceId");

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_proformaSourceId_fkey" FOREIGN KEY ("proformaSourceId") REFERENCES "invoices"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoice_lines" ADD CONSTRAINT "invoice_lines_convertedToInvoiceId_fkey" FOREIGN KEY ("convertedToInvoiceId") REFERENCES "invoices"("id") ON DELETE SET NULL ON UPDATE CASCADE;
