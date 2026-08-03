import { redirect } from "next/navigation";
import { getServerSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { canViewTracking } from "@/lib/permissions";
import TrackView from "./TrackView";

export default async function TrackPage() {
  const session = await getServerSession();
  if (!(await canViewTracking(session!.tenantId, session!.role))) redirect("/dashboard");

  const staff = await prisma.user.findMany({
    where: { tenantId: session!.tenantId, role: { not: "OWNER" } },
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      email: true,
      locationPing: { select: { lat: true, lng: true, pingedAt: true } },
    },
  });

  const serialized = staff.map((s) => ({
    id: s.id,
    name: s.name,
    email: s.email,
    ping: s.locationPing
      ? { lat: s.locationPing.lat.toString(), lng: s.locationPing.lng.toString(), pingedAt: s.locationPing.pingedAt.toISOString() }
      : null,
  }));

  return (
    <div>
      <h1 className="afs-page-title">Track</h1>
      <p className="afs-page-subtitle">Last-known location while each person has the app open -- not a live map or movement history</p>
      <div style={{ marginTop: 20 }}>
        <TrackView staff={serialized} />
      </div>
    </div>
  );
}
