import { NextRequest, NextResponse } from "next/server";
import { requireSession, SessionError } from "@/lib/session";
import { marksOwnAttendance } from "@/lib/permissions";
import { recordPunch, AttendanceError } from "@/lib/attendance";
import { checkRateLimit } from "@/lib/rate-limit";

export async function POST(request: NextRequest) {
  let session;
  try {
    session = requireSession(request);
  } catch (e) {
    if (e instanceof SessionError) return NextResponse.json({ error: e.message }, { status: 401 });
    throw e;
  }
  if (!(await marksOwnAttendance(session.tenantId, session.roleId))) {
    return NextResponse.json({ error: "Owners don't check in -- use the admin view instead" }, { status: 403 });
  }
  if (!checkRateLimit(`checkin:${session.userId}`, 5, 60_000)) {
    return NextResponse.json({ error: "Too many attempts -- wait a moment and try again" }, { status: 429 });
  }

  const body = await request.json().catch(() => ({}));
  const { lat, lng, photo, siteId, outsideGeofenceReason } = body;
  if (typeof lat !== "number" || typeof lng !== "number" || typeof photo !== "string" || !photo) {
    return NextResponse.json({ error: "lat, lng, and photo are required" }, { status: 400 });
  }
  if (siteId !== undefined && typeof siteId !== "string") {
    return NextResponse.json({ error: "siteId must be a string" }, { status: 400 });
  }
  if (outsideGeofenceReason !== undefined && typeof outsideGeofenceReason !== "string") {
    return NextResponse.json({ error: "outsideGeofenceReason must be a string" }, { status: 400 });
  }

  try {
    const record = await recordPunch({
      tenantId: session.tenantId,
      userId: session.userId,
      kind: "CHECK_IN",
      lat,
      lng,
      photo,
      siteId: siteId || undefined,
      outsideGeofenceReason: outsideGeofenceReason || undefined,
    });
    return NextResponse.json(record, { status: 201 });
  } catch (e) {
    if (e instanceof AttendanceError) return NextResponse.json({ error: e.message, code: e.code }, { status: e.status });
    throw e;
  }
}
