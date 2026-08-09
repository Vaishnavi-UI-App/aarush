-- AlterTable
ALTER TABLE "invoice_lines" ADD COLUMN     "detail" TEXT,
ADD COLUMN     "unit" TEXT NOT NULL DEFAULT 'NOS';

-- AlterTable
ALTER TABLE "items" ADD COLUMN     "description" TEXT;
