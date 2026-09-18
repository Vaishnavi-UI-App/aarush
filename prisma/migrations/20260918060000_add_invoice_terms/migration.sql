-- Per-invoice Terms & Conditions, so the wording can be changed for a particular
-- customer without touching the company-wide default.
-- NULL means "use the company terms", which is every invoice already raised.
ALTER TABLE "invoices" ADD COLUMN "termsAndConditions" TEXT;
