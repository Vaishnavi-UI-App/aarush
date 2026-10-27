-- Keep the generated GST portal JSON in the system rather than only in the creator's
-- downloads folder: whoever actually files the return is rarely whoever pressed the
-- button, and they need the exact same file.
CREATE TABLE "gst_json_exports" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "period" TEXT NOT NULL,
    "invoiceCount" INTEGER NOT NULL,
    "byteSize" INTEGER NOT NULL,
    "payload" TEXT NOT NULL,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "gst_json_exports_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "gst_json_exports_tenantId_createdAt_idx" ON "gst_json_exports"("tenantId", "createdAt");

ALTER TABLE "gst_json_exports" ADD CONSTRAINT "gst_json_exports_tenantId_fkey"
    FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "gst_json_exports" ADD CONSTRAINT "gst_json_exports_createdById_fkey"
    FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Replaces the name/date pair added earlier today with a reference to the stored file.
-- Both columns are still null on every invoice, so nothing is lost.
ALTER TABLE "invoices" DROP COLUMN "gstJsonName";
ALTER TABLE "invoices" DROP COLUMN "gstJsonAt";
ALTER TABLE "invoices" ADD COLUMN "gstJsonExportId" TEXT;

CREATE INDEX "invoices_gstJsonExportId_idx" ON "invoices"("gstJsonExportId");
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_gstJsonExportId_fkey"
    FOREIGN KEY ("gstJsonExportId") REFERENCES "gst_json_exports"("id") ON DELETE SET NULL ON UPDATE CASCADE;
