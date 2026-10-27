-- Records which GST portal JSON an invoice was last exported in, so the app can warn
-- before the same bill goes into a second return file and can name the one it is
-- already in. NULL means never exported, which is every invoice raised so far.
ALTER TABLE "invoices" ADD COLUMN "gstJsonName" TEXT;
ALTER TABLE "invoices" ADD COLUMN "gstJsonAt" TIMESTAMP(3);
