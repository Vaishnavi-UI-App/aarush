import { NextRequest, NextResponse } from "next/server";
import { requireSession, SessionError } from "@/lib/session";
import { marksOwnAttendance } from "@/lib/permissions";
import { endBreak, AttendanceError } from "@/lib/attendance";
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
  if (!checkRateLimit(`break:${session.userId}`, 10, 60_000)) {
    return NextResponse.json({ error: "Too many attempts -- wait a moment and try again" }, { status: 429 });
  }

  try {
    const record = await endBreak(session.tenantId, session.userId);
    return NextResponse.json(record);
  } catch (e) {
    if (e instanceof AttendanceError) return NextResponse.json({ error: e.message, code: e.code }, { status: e.status });
    throw e;
  }
}
