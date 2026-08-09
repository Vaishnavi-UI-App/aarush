import { NextRequest, NextResponse } from "next/server";
import { requireSession, SessionError } from "@/lib/session";
import { prisma } from "@/lib/prisma";

/** Self-service profile update -- a user editing their own name/phone/photo needs no
 * page permission beyond being logged in, since it only ever touches their own row
 * (userId comes from the verified session, never the request body). */
export async function PATCH(request: NextRequest) {
  let session;
  try {
    session = requireSession(request);
  } catch (e) {
    if (e instanceof SessionError) return NextResponse.json({ error: e.message }, { status: 401 });
    throw e;
  }

  const body = await request.json();
  if (!body.name || typeof body.name !== "string") {
    return NextResponse.json({ error: "Name is required" }, { status: 400 });
  }

  const updated = await prisma.user.update({
    where: { id: session.userId },
    data: {
      name: body.name.trim(),
      phone: body.phone?.trim() || null,
      ...(body.photoData !== undefined ? { photoData: body.photoData || null } : {}),
    },
    select: { id: true, name: true, email: true, phone: true, photoData: true },
  });

  return NextResponse.json(updated);
}
