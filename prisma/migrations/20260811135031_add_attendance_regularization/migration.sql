-- CreateEnum
CREATE TYPE "RegularizationStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateTable
CREATE TABLE "attendance_regularizations" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "requestedCheckInAt" TIMESTAMP(3),
    "requestedCheckOutAt" TIMESTAMP(3),
    "reason" TEXT NOT NULL,
    "status" "RegularizationStatus" NOT NULL DEFAULT 'PENDING',
    "reviewNote" TEXT,
    "reviewedById" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "attendance_regularizations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "attendance_regularizations_tenantId_userId_idx" ON "attendance_regularizations"("tenantId", "userId");

-- CreateIndex
CREATE INDEX "attendance_regularizations_tenantId_status_idx" ON "attendance_regularizations"("tenantId", "status");

-- AddForeignKey
ALTER TABLE "attendance_regularizations" ADD CONSTRAINT "attendance_regularizations_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendance_regularizations" ADD CONSTRAINT "attendance_regularizations_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendance_regularizations" ADD CONSTRAINT "attendance_regularizations_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
