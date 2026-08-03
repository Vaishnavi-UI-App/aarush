-- CreateTable
CREATE TABLE "attendance_records" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "checkInAt" TIMESTAMP(3),
    "checkInLat" DECIMAL(9,6),
    "checkInLng" DECIMAL(9,6),
    "checkInPhotoData" TEXT,
    "checkOutAt" TIMESTAMP(3),
    "checkOutLat" DECIMAL(9,6),
    "checkOutLng" DECIMAL(9,6),
    "checkOutPhotoData" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "attendance_records_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "attendance_records_tenantId_date_idx" ON "attendance_records"("tenantId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "attendance_records_tenantId_userId_date_key" ON "attendance_records"("tenantId", "userId", "date");

-- AddForeignKey
ALTER TABLE "attendance_records" ADD CONSTRAINT "attendance_records_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendance_records" ADD CONSTRAINT "attendance_records_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
