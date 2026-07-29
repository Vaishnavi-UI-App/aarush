-- Give SALE and PROFORMA invoices independent numbering sequences per tenant/financial year.
DROP INDEX "invoice_counters_tenantId_financialYear_key";
ALTER TABLE "invoice_counters" ADD COLUMN "type" "InvoiceType" NOT NULL DEFAULT 'SALE';
CREATE UNIQUE INDEX "invoice_counters_tenantId_financialYear_type_key" ON "invoice_counters"("tenantId", "financialYear", "type");
