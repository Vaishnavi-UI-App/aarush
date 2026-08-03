import { NextRequest, NextResponse } from "next/server";
import { requireSession, SessionError } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { marksOwnAttendance } from "@/lib/permissions";

// See check-in/route.ts for why this must be UTC-midnight of the local calendar day.
function startOfToday(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
}

export async function POST(request: NextRequest) {
  let session;
  try {
    session = requireSession(request);
  } catch (e) {
    if (e instanceof SessionError) return NextResponse.json({ error: e.message }, { status: 401 });
    throw e;
  }
  if (!marksOwnAttendance(session.role)) {
    return NextResponse.json({ error: "Owners don't check in -- use the admin view instead" }, { status: 403 });
  }

  const body = await request.json().catch(() => ({}));
  const { lat, lng, photo } = body;
  if (typeof lat !== "number" || typeof lng !== "number" || typeof photo !== "string" || !photo) {
    return NextResponse.json({ error: "lat, lng, and photo are required" }, { status: 400 });
  }

  const date = startOfToday();
  const existing = await prisma.attendanceRecord.findUnique({
    where: { tenantId_userId_date: { tenantId: session.tenantId, userId: session.userId, date } },
  });
  if (!existing?.checkInAt) {
    return NextResponse.json({ error: "You haven't checked in today" }, { status: 409 });
  }
  if (existing.checkOutAt) {
    return NextResponse.json({ error: "You've already checked out today" }, { status: 409 });
  }

  const record = await prisma.attendanceRecord.update({
    where: { tenantId_userId_date: { tenantId: session.tenantId, userId: session.userId, date } },
    data: {
      checkOutAt: new Date(),
      checkOutLat: lat,
      checkOutLng: lng,
      checkOutPhotoData: photo,
    },
  });

  return NextResponse.json(record);
}
