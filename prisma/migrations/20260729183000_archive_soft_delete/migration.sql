-- Soft-delete support: archived records are hidden from normal lists but never
-- destroyed, and can be restored (audit trail is preserved).
ALTER TABLE "invoices" ADD COLUMN "archivedAt" TIMESTAMP(3);
ALTER TABLE "purchases" ADD COLUMN "archivedAt" TIMESTAMP(3);
