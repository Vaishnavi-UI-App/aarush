-- AlterTable
ALTER TABLE "delivery_challans" ADD COLUMN     "siteId" TEXT;

-- AlterTable
ALTER TABLE "invoices" ADD COLUMN     "paymentTerms" TEXT,
ADD COLUMN     "siteId" TEXT;

-- AlterTable
ALTER TABLE "purchases" ADD COLUMN     "siteId" TEXT;

-- CreateIndex
CREATE INDEX "delivery_challans_tenantId_siteId_idx" ON "delivery_challans"("tenantId", "siteId");

-- CreateIndex
CREATE INDEX "invoices_tenantId_siteId_idx" ON "invoices"("tenantId", "siteId");

-- CreateIndex
CREATE INDEX "purchases_tenantId_siteId_idx" ON "purchases"("tenantId", "siteId");

-- AddForeignKey
ALTER TABLE "delivery_challans" ADD CONSTRAINT "delivery_challans_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "sites"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "sites"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchases" ADD CONSTRAINT "purchases_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "sites"("id") ON DELETE SET NULL ON UPDATE CASCADE;
