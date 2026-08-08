-- AlterTable
ALTER TABLE "location_pings" ADD COLUMN     "distanceMeters" INTEGER,
ADD COLUMN     "nearestSiteId" TEXT,
ADD COLUMN     "sharingEnabled" BOOLEAN NOT NULL DEFAULT true,
ALTER COLUMN "lat" DROP NOT NULL,
ALTER COLUMN "lng" DROP NOT NULL;

-- AddForeignKey
ALTER TABLE "location_pings" ADD CONSTRAINT "location_pings_nearestSiteId_fkey" FOREIGN KEY ("nearestSiteId") REFERENCES "sites"("id") ON DELETE SET NULL ON UPDATE CASCADE;
