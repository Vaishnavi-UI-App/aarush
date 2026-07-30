-- Vendor's own bill/invoice number (for 3-way matching against our internal PB number)
ALTER TABLE "purchases" ADD COLUMN "vendorBillNumber" TEXT;

-- Running stock quantity on hand, incremented when a purchase bill is received
ALTER TABLE "items" ADD COLUMN "currentStock" DECIMAL(12,3) NOT NULL DEFAULT 0;
