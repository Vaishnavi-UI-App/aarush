-- CreateTable
CREATE TABLE "delivery_challan_counters" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "financialYear" TEXT NOT NULL,
    "lastSequence" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "delivery_challan_counters_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "delivery_challans" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "customerId" TEXT,
    "number" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "toName" TEXT,
    "toAddress" TEXT,
    "poNumber" TEXT,
    "poDate" TIMESTAMP(3),
    "vehicleNumber" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "archivedAt" TIMESTAMP(3),

    CONSTRAINT "delivery_challans_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "delivery_challan_lines" (
    "id" TEXT NOT NULL,
    "challanId" TEXT NOT NULL,
    "srNo" INTEGER NOT NULL,
    "particulars" TEXT NOT NULL,
    "qty" DECIMAL(12,3) NOT NULL,

    CONSTRAINT "delivery_challan_lines_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "delivery_challan_counters_tenantId_financialYear_key" ON "delivery_challan_counters"("tenantId", "financialYear");

-- CreateIndex
CREATE INDEX "delivery_challans_tenantId_customerId_idx" ON "delivery_challans"("tenantId", "customerId");

-- CreateIndex
CREATE UNIQUE INDEX "delivery_challans_tenantId_number_key" ON "delivery_challans"("tenantId", "number");

-- AddForeignKey
ALTER TABLE "delivery_challan_counters" ADD CONSTRAINT "delivery_challan_counters_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "delivery_challans" ADD CONSTRAINT "delivery_challans_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "delivery_challans" ADD CONSTRAINT "delivery_challans_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "delivery_challan_lines" ADD CONSTRAINT "delivery_challan_lines_challanId_fkey" FOREIGN KEY ("challanId") REFERENCES "delivery_challans"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
