-- AlterTable
ALTER TABLE "invoices" ADD COLUMN     "deliveredThrough" TEXT,
ADD COLUMN     "poDate" TIMESTAMP(3),
ADD COLUMN     "poNumber" TEXT,
ADD COLUMN     "reverseCharge" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "shipToAddress" TEXT,
ADD COLUMN     "shipToGstin" TEXT,
ADD COLUMN     "shipToName" TEXT,
ADD COLUMN     "shipToSameAsBilling" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "shipToStateCode" TEXT,
ADD COLUMN     "transportationMode" TEXT,
ADD COLUMN     "vehicleNumber" TEXT;
