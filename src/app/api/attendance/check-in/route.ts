import { NextRequest, NextResponse } from "next/server";
import { requireSession, SessionError } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { marksOwnAttendance } from "@/lib/permissions";

// A @db.Date column has no timezone, so the value must be constructed at UTC midnight
// of the server's *local* calendar day -- setHours(0,0,0,0) followed by serialization
// truncates to the UTC calendar day instead, which is off by one in any timezone ahead
// of UTC (e.g. IST, UTC+5:30) for hours after local midnight but before UTC midnight.
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
  if (existing?.checkInAt) {
    return NextResponse.json({ error: "You've already checked in today" }, { status: 409 });
  }

  const record = await prisma.attendanceRecord.upsert({
    where: { tenantId_userId_date: { tenantId: session.tenantId, userId: session.userId, date } },
    create: {
      tenantId: session.tenantId,
      userId: session.userId,
      date,
      checkInAt: new Date(),
      checkInLat: lat,
      checkInLng: lng,
      checkInPhotoData: photo,
    },
    update: {
      checkInAt: new Date(),
      checkInLat: lat,
      checkInLng: lng,
      checkInPhotoData: photo,
    },
  });

  return NextResponse.json(record, { status: 201 });
}
