-- Business profile fields needed to render the tenant's own invoice PDFs
-- (seller header block, bank details block) for real created invoices.
ALTER TABLE "tenants" ADD COLUMN "phone" TEXT;
ALTER TABLE "tenants" ADD COLUMN "email" TEXT;
ALTER TABLE "tenants" ADD COLUMN "logoUrl" TEXT DEFAULT '/logo.jpeg';
ALTER TABLE "tenants" ADD COLUMN "bankAccountName" TEXT;
ALTER TABLE "tenants" ADD COLUMN "bankAccountNo" TEXT;
ALTER TABLE "tenants" ADD COLUMN "bankIfsc" TEXT;
ALTER TABLE "tenants" ADD COLUMN "bankName" TEXT;
ALTER TABLE "tenants" ADD COLUMN "bankBranch" TEXT;
ALTER TABLE "tenants" ADD COLUMN "invoiceTerms" TEXT;
