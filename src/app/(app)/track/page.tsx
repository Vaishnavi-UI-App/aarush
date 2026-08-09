import { redirect } from "next/navigation";
import { getServerSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { can } from "@/lib/permissions";
import { reverseGeocode } from "@/lib/reverse-geocode";
import TrackView from "./TrackView";

export default async function TrackPage() {
  const session = await getServerSession();
  if (!(await can(session!.tenantId, session!.roleId, "track", "view"))) redirect("/dashboard");

  const [staff, sites] = await Promise.all([
    prisma.user.findMany({
      where: { tenantId: session!.tenantId, role: { not: "OWNER" } },
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        email: true,
        locationPing: {
          select: { lat: true, lng: true, pingedAt: true, sharingEnabled: true, distanceMeters: true, nearestSite: { select: { name: true } } },
        },
      },
    }),
    prisma.site.findMany({
      where: { tenantId: session!.tenantId, archivedAt: null },
      orderBy: { name: "asc" },
      select: { id: true, name: true, latitude: true, longitude: true, geofenceRadiusM: true },
    }),
  ]);

  const serializedStaff = await Promise.all(
    staff.map(async (s) => {
      const lat = s.locationPing?.lat != null ? Number(s.locationPing.lat) : null;
      const lng = s.locationPing?.lng != null ? Number(s.locationPing.lng) : null;
      const placeName = lat != null && lng != null ? await reverseGeocode(lat, lng) : null;

      return {
        id: s.id,
        name: s.name,
        email: s.email,
        ping: s.locationPing
          ? {
              lat: s.locationPing.lat != null ? s.locationPing.lat.toString() : null,
              lng: s.locationPing.lng != null ? s.locationPing.lng.toString() : null,
              placeName,
              pingedAt: s.locationPing.pingedAt.toISOString(),
              sharingEnabled: s.locationPing.sharingEnabled,
              nearestSiteName: s.locationPing.nearestSite?.name ?? null,
              distanceMeters: s.locationPing.distanceMeters,
            }
          : null,
      };
    })
  );

  const serializedSites = sites.map((s) => ({
    id: s.id,
    name: s.name,
    latitude: s.latitude != null ? s.latitude.toString() : null,
    longitude: s.longitude != null ? s.longitude.toString() : null,
    geofenceRadiusM: s.geofenceRadiusM,
  }));

  return (
    <div>
      <h1 className="afs-page-title">Track</h1>
      <p className="afs-page-subtitle">
        Live position while sharing is turned on -- keeps updating in the background on Android even after the app is
        closed, once the person has accepted the background-location prompt -- nearest site, not attendance status
      </p>
      <div style={{ marginTop: 20 }}>
        <TrackView staff={serializedStaff} sites={serializedSites} />
      </div>
    </div>
  );
}
