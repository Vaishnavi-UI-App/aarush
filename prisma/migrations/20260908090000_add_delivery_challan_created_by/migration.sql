-- AlterTable
ALTER TABLE "delivery_challans" ADD COLUMN     "createdById" TEXT;

-- CreateIndex
CREATE INDEX "delivery_challans_tenantId_createdById_idx" ON "delivery_challans"("tenantId", "createdById");

-- AddForeignKey
ALTER TABLE "delivery_challans" ADD CONSTRAINT "delivery_challans_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
