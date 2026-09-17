-- Each invoice line's share of the invoice-level discount, so GST can be charged on the
-- discounted transaction value instead of the gross one (CGST Act s.15(3)(a): a discount
-- shown on the invoice at the time of supply is excluded from the value of supply).
--
-- Defaults to 0, so every invoice already issued keeps exactly the tax and total it was
-- issued with. Only invoices created or edited from here on use the new calculation.
ALTER TABLE "invoice_lines" ADD COLUMN "discountAmount" DECIMAL(14,2) NOT NULL DEFAULT 0;
