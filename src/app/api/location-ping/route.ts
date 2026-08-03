import { NextRequest, NextResponse } from "next/server";
import { requireSession, SessionError } from "@/lib/session";
import { prisma } from "@/lib/prisma";

export async function POST(request: NextRequest) {
  let session;
  try {
    session = requireSession(request);
  } catch (e) {
    if (e instanceof SessionError) return NextResponse.json({ error: e.message }, { status: 401 });
    throw e;
  }
  // Defense in depth -- the client never pings for OWNER, but reject it here too.
  if (session.role === "OWNER") {
    return NextResponse.json({ error: "Owners aren't tracked" }, { status: 403 });
  }

  const body = await request.json().catch(() => ({}));
  const { lat, lng } = body;
  if (typeof lat !== "number" || typeof lng !== "number") {
    return NextResponse.json({ error: "lat and lng are required" }, { status: 400 });
  }

  const ping = await prisma.locationPing.upsert({
    where: { userId: session.userId },
    create: { tenantId: session.tenantId, userId: session.userId, lat, lng },
    update: { lat, lng, pingedAt: new Date() },
  });

  return NextResponse.json(ping);
}
