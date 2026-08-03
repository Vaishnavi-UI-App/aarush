-- CreateEnum
CREATE TYPE "ExpenseFundType" AS ENUM ('COMPANY', 'PERSONAL', 'SPLIT');

-- CreateTable
CREATE TABLE "sites" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "address" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "archivedAt" TIMESTAMP(3),

    CONSTRAINT "sites_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "site_wallets" (
    "id" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "companyBalance" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "totalFundsReceived" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "totalCompanySpent" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "totalPersonalSpent" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "totalPersonalReimbursed" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "site_wallets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fund_allocations" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "reimbursedToPersonal" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "addedToBalance" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "note" TEXT,
    "addedById" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "fund_allocations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "expense_categories" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "expense_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ordered_by_people" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ordered_by_people_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "expenses" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "categoryId" TEXT,
    "orderedById" TEXT,
    "amount" DECIMAL(14,2) NOT NULL,
    "companyPaid" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "personalPaid" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "fundType" "ExpenseFundType" NOT NULL,
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "note" TEXT,
    "receiptPhotoData" TEXT,
    "addedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "expenses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "location_pings" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "lat" DECIMAL(9,6) NOT NULL,
    "lng" DECIMAL(9,6) NOT NULL,
    "pingedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "location_pings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "sites_tenantId_idx" ON "sites"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "site_wallets_siteId_key" ON "site_wallets"("siteId");

-- CreateIndex
CREATE INDEX "fund_allocations_tenantId_siteId_idx" ON "fund_allocations"("tenantId", "siteId");

-- CreateIndex
CREATE UNIQUE INDEX "expense_categories_tenantId_name_key" ON "expense_categories"("tenantId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "ordered_by_people_tenantId_name_key" ON "ordered_by_people"("tenantId", "name");

-- CreateIndex
CREATE INDEX "expenses_tenantId_siteId_idx" ON "expenses"("tenantId", "siteId");

-- CreateIndex
CREATE INDEX "expenses_tenantId_addedById_idx" ON "expenses"("tenantId", "addedById");

-- CreateIndex
CREATE UNIQUE INDEX "location_pings_userId_key" ON "location_pings"("userId");

-- CreateIndex
CREATE INDEX "location_pings_tenantId_idx" ON "location_pings"("tenantId");

-- AddForeignKey
ALTER TABLE "sites" ADD CONSTRAINT "sites_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "site_wallets" ADD CONSTRAINT "site_wallets_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "sites"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fund_allocations" ADD CONSTRAINT "fund_allocations_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fund_allocations" ADD CONSTRAINT "fund_allocations_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "sites"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fund_allocations" ADD CONSTRAINT "fund_allocations_addedById_fkey" FOREIGN KEY ("addedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "expense_categories" ADD CONSTRAINT "expense_categories_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ordered_by_people" ADD CONSTRAINT "ordered_by_people_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "sites"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "expense_categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_orderedById_fkey" FOREIGN KEY ("orderedById") REFERENCES "ordered_by_people"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_addedById_fkey" FOREIGN KEY ("addedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "location_pings" ADD CONSTRAINT "location_pings_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "location_pings" ADD CONSTRAINT "location_pings_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
