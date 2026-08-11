import { NextRequest, NextResponse } from "next/server";
import { requireSession, SessionError } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { can } from "@/lib/permissions";
import { geocodeSiteLocation, PINCODE_GEOFENCE_RADIUS_M } from "@/lib/reverse-geocode";

export async function GET(request: NextRequest) {
  let session;
  try {
    session = requireSession(request);
  } catch (e) {
    if (e instanceof SessionError) return NextResponse.json({ error: e.message }, { status: 401 });
    throw e;
  }

  // Every role can read the site list -- the expense form's site dropdown needs this
  // even for staff who can't see wallet balances.
  const sites = await prisma.site.findMany({
    where: { tenantId: session.tenantId, archivedAt: null },
    orderBy: { name: "asc" },
    select: { id: true, name: true, address: true, pincode: true },
  });

  return NextResponse.json(sites);
}

export async function POST(request: NextRequest) {
  let session;
  try {
    session = requireSession(request);
  } catch (e) {
    if (e instanceof SessionError) return NextResponse.json({ error: e.message }, { status: 401 });
    throw e;
  }
  if (!(await can(session.tenantId, session.roleId, "sites", "add"))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json().catch(() => ({}));
  if (!body.name || typeof body.name !== "string") {
    return NextResponse.json({ error: "name is required" }, { status: 400 });
  }

  const pincode = body.pincode ? String(body.pincode).trim() : null;
  const geocoded = await geocodeSiteLocation(pincode, body.address);

  const site = await prisma.site.create({
    data: {
      tenantId: session.tenantId,
      name: body.name,
      address: body.address || null,
      pincode,
      latitude: geocoded?.lat ?? null,
      longitude: geocoded?.lng ?? null,
      geofenceRadiusM: geocoded ? PINCODE_GEOFENCE_RADIUS_M : null,
      wallet: { create: {} },
    },
    include: { wallet: true },
  });

  return NextResponse.json({ ...site, geocodeFailed: !!pincode && !geocoded }, { status: 201 });
}
