-- Discount entered as a percentage, plus the reason it was given.
-- The rupee amount in "discount" stays the source of truth for all arithmetic;
-- discountPercent only records how the user expressed it, so the invoice can print
-- "Less : Discount (5%)" and the edit form can show back the number they typed.
ALTER TABLE "invoices" ADD COLUMN "discountPercent" DECIMAL(5,2);
ALTER TABLE "invoices" ADD COLUMN "discountReason" TEXT;
