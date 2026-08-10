import { NextRequest, NextResponse } from "next/server";
import { requireSession, SessionError } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { can } from "@/lib/permissions";

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  let session;
  try {
    session = requireSession(request);
  } catch (e) {
    if (e instanceof SessionError) return NextResponse.json({ error: e.message }, { status: 401 });
    throw e;
  }
  if (!(await can(session.tenantId, session.roleId, "sites", "view"))) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  const site = await prisma.site.findFirst({
    where: { id, tenantId: session.tenantId },
    include: {
      wallet: true,
      fundAllocations: { orderBy: { createdAt: "desc" }, include: { addedBy: { select: { name: true, email: true } } } },
      expenses: {
        orderBy: { date: "desc" },
        include: {
          category: true,
          orderedBy: true,
          addedBy: { select: { name: true, email: true } },
        },
      },
    },
  });
  if (!site) {
    return NextResponse.json({ error: "Site not found" }, { status: 404 });
  }

  return NextResponse.json(site);
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  let session;
  try {
    session = requireSession(request);
  } catch (e) {
    if (e instanceof SessionError) return NextResponse.json({ error: e.message }, { status: 401 });
    throw e;
  }
  if (!(await can(session.tenantId, session.roleId, "sites", "edit"))) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  const existing = await prisma.site.findFirst({ where: { id, tenantId: session.tenantId } });
  if (!existing) return NextResponse.json({ error: "Site not found" }, { status: 404 });

  const body = await request.json().catch(() => ({}));
  const data: Record<string, unknown> = {};

  if (body.name !== undefined) {
    if (typeof body.name !== "string" || !body.name.trim()) {
      return NextResponse.json({ error: "name can't be empty" }, { status: 400 });
    }
    data.name = body.name.trim();
  }
  if (body.address !== undefined) {
    data.address = body.address || null;
  }

  if ("latitude" in body || "longitude" in body || "geofenceRadiusM" in body) {
    const { latitude, longitude, geofenceRadiusM } = body;
    // All three null together clears the geofence; otherwise all three are required so
    // a half-configured geofence (e.g. a radius with no coordinates) can't be saved.
    const clearing = latitude === null && longitude === null && geofenceRadiusM === null;
    if (!clearing) {
      if (typeof latitude !== "number" || latitude < -90 || latitude > 90) {
        return NextResponse.json({ error: "latitude must be a number between -90 and 90" }, { status: 400 });
      }
      if (typeof longitude !== "number" || longitude < -180 || longitude > 180) {
        return NextResponse.json({ error: "longitude must be a number between -180 and 180" }, { status: 400 });
      }
      if (typeof geofenceRadiusM !== "number" || geofenceRadiusM <= 0) {
        return NextResponse.json({ error: "geofenceRadiusM must be a positive number" }, { status: 400 });
      }
    }
    data.latitude = latitude;
    data.longitude = longitude;
    data.geofenceRadiusM = geofenceRadiusM;
  }

  const site = await prisma.site.update({ where: { id }, data });
  return NextResponse.json(site);
}
