-- CreateEnum
CREATE TYPE "PayslipStatus" AS ENUM ('DRAFT', 'FINALIZED');

-- CreateTable
CREATE TABLE "payroll_configs" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "basicPercent" DECIMAL(5,2) NOT NULL DEFAULT 50,
    "hraPercent" DECIMAL(5,2) NOT NULL DEFAULT 20,
    "conveyancePercent" DECIMAL(5,2) NOT NULL DEFAULT 10,
    "medicalPercent" DECIMAL(5,2) NOT NULL DEFAULT 10,
    "specialAllowancePercent" DECIMAL(5,2) NOT NULL DEFAULT 10,
    "professionalTax" DECIMAL(10,2) NOT NULL DEFAULT 200,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payroll_configs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payslips" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "month" INTEGER NOT NULL,
    "workingDays" DECIMAL(5,2) NOT NULL,
    "presentDays" DECIMAL(5,2) NOT NULL,
    "lopDays" DECIMAL(5,2) NOT NULL,
    "basic" DECIMAL(12,2) NOT NULL,
    "hra" DECIMAL(12,2) NOT NULL,
    "conveyance" DECIMAL(12,2) NOT NULL,
    "medicalAllowance" DECIMAL(12,2) NOT NULL,
    "specialAllowance" DECIMAL(12,2) NOT NULL,
    "grossEarnings" DECIMAL(12,2) NOT NULL,
    "tds" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "professionalTax" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "lopDeduction" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "otherDeductions" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "totalDeductions" DECIMAL(12,2) NOT NULL,
    "reimbursements" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "netPayable" DECIMAL(12,2) NOT NULL,
    "status" "PayslipStatus" NOT NULL DEFAULT 'DRAFT',
    "finalizedAt" TIMESTAMP(3),
    "finalizedById" TEXT,
    "emailedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payslips_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "payroll_configs_tenantId_key" ON "payroll_configs"("tenantId");

-- CreateIndex
CREATE INDEX "payslips_tenantId_year_month_idx" ON "payslips"("tenantId", "year", "month");

-- CreateIndex
CREATE UNIQUE INDEX "payslips_tenantId_userId_year_month_key" ON "payslips"("tenantId", "userId", "year", "month");

-- AddForeignKey
ALTER TABLE "payroll_configs" ADD CONSTRAINT "payroll_configs_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payslips" ADD CONSTRAINT "payslips_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payslips" ADD CONSTRAINT "payslips_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payslips" ADD CONSTRAINT "payslips_finalizedById_fkey" FOREIGN KEY ("finalizedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

