import { NextRequest, NextResponse } from "next/server";
import { requireSession, SessionError } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { can } from "@/lib/permissions";
import { reconcileStaleOpenDays } from "@/lib/attendance";

export async function GET(request: NextRequest) {
  let session;
  try {
    session = requireSession(request);
  } catch (e) {
    if (e instanceof SessionError) return NextResponse.json({ error: e.message }, { status: 401 });
    throw e;
  }

  const params = request.nextUrl.searchParams;
  const requestedUserId = params.get("userId") || undefined;
  const from = params.get("from") || undefined;
  const to = params.get("to") || undefined;

  // Only a role with allAttendance:view can look at anyone else's records -- everyone
  // else is forced to their own, no matter what userId they pass.
  const canSeeAll = await can(session.tenantId, session.roleId, "allAttendance", "view");
  const userId = canSeeAll ? requestedUserId : session.userId;

  await reconcileStaleOpenDays(session.tenantId, userId);

  const records = await prisma.attendanceRecord.findMany({
    where: {
      tenantId: session.tenantId,
      ...(userId ? { userId } : {}),
      ...(from || to
        ? {
            date: {
              ...(from ? { gte: new Date(from) } : {}),
              ...(to ? { lte: new Date(to) } : {}),
            },
          }
        : {}),
    },
    include: {
      user: { select: { id: true, name: true, email: true, roleRef: { select: { name: true } } } },
      site: { select: { id: true, name: true } },
      breaks: { orderBy: { startAt: "asc" } },
    },
    orderBy: { date: "desc" },
  });

  const withHours = records.map((r) => ({
    ...r,
    hours: r.computedWorkHours != null ? Number(r.computedWorkHours) : r.checkInAt && r.checkOutAt ? (r.checkOutAt.getTime() - r.checkInAt.getTime()) / 3_600_000 : null,
  }));

  return NextResponse.json(withHours);
}
