import { NextRequest, NextResponse } from "next/server";
import { requireSession, SessionError } from "@/lib/session";
import { prisma } from "@/lib/prisma";

/** Current sharing preference for the logged-in user -- read on mount so the toggle UI
 * reflects the real server state (e.g. turned off from another tab/device), not just
 * whatever the client last remembered. Defaults to "on" if there's no row yet (matches
 * LocationPing's own default and today's out-of-the-box behavior). */
export async function GET(request: NextRequest) {
  let session;
  try {
    session = requireSession(request);
  } catch (e) {
    if (e instanceof SessionError) return NextResponse.json({ error: e.message }, { status: 401 });
    throw e;
  }

  const ping = await prisma.locationPing.findUnique({ where: { userId: session.userId }, select: { sharingEnabled: true } });
  return NextResponse.json({ sharingEnabled: ping?.sharingEnabled ?? true });
}

export async function POST(request: NextRequest) {
  let session;
  try {
    session = requireSession(request);
  } catch (e) {
    if (e instanceof SessionError) return NextResponse.json({ error: e.message }, { status: 401 });
    throw e;
  }

  const body = await request.json().catch(() => ({}));
  const { enabled } = body;
  if (typeof enabled !== "boolean") {
    return NextResponse.json({ error: "enabled must be a boolean" }, { status: 400 });
  }

  const ping = await prisma.locationPing.upsert({
    where: { userId: session.userId },
    create: { tenantId: session.tenantId, userId: session.userId, sharingEnabled: enabled },
    update: { sharingEnabled: enabled },
    select: { sharingEnabled: true },
  });

  return NextResponse.json(ping);
}
