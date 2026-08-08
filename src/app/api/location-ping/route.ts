import { NextRequest, NextResponse } from "next/server";
import { requireSession, SessionError } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { canManageUsers } from "@/lib/permissions";
import { findNearestSite } from "@/lib/geo";

export async function POST(request: NextRequest) {
  let session;
  try {
    session = requireSession(request);
  } catch (e) {
    if (e instanceof SessionError) return NextResponse.json({ error: e.message }, { status: 401 });
    throw e;
  }
  // Defense in depth -- the client never pings for the owner, but reject it here too.
  if (await canManageUsers(session.tenantId, session.roleId)) {
    return NextResponse.json({ error: "Owners aren't tracked" }, { status: 403 });
  }

  const body = await request.json().catch(() => ({}));
  const { lat, lng } = body;
  if (typeof lat !== "number" || typeof lng !== "number") {
    return NextResponse.json({ error: "lat and lng are required" }, { status: 400 });
  }

  const existing = await prisma.locationPing.findUnique({ where: { userId: session.userId }, select: { sharingEnabled: true } });
  if (existing && !existing.sharingEnabled) {
    return NextResponse.json({ error: "Location sharing is turned off" }, { status: 403 });
  }

  const sites = await prisma.site.findMany({
    where: { tenantId: session.tenantId, archivedAt: null, latitude: { not: null }, longitude: { not: null } },
    select: { id: true, latitude: true, longitude: true },
  });
  const nearest = findNearestSite(sites, lat, lng);

  const ping = await prisma.locationPing.upsert({
    where: { userId: session.userId },
    create: {
      tenantId: session.tenantId,
      userId: session.userId,
      lat,
      lng,
      sharingEnabled: true,
      nearestSiteId: nearest?.site.id,
      distanceMeters: nearest?.distanceMeters,
    },
    update: {
      lat,
      lng,
      pingedAt: new Date(),
      sharingEnabled: true,
      nearestSiteId: nearest?.site.id ?? null,
      distanceMeters: nearest?.distanceMeters ?? null,
    },
  });

  return NextResponse.json(ping);
}
