import { NextRequest, NextResponse } from "next/server";
import { requireSession, SessionError } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { can } from "@/lib/permissions";

/** Hands back a GST JSON that was generated earlier. The file is stored against the
 * tenant, not the person who made it, so whoever actually files the return can fetch
 * the exact same bytes that were handed to whoever pressed the button. */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  let session;
  try {
    session = requireSession(request);
  } catch (e) {
    if (e instanceof SessionError) return NextResponse.json({ error: e.message }, { status: 401 });
    throw e;
  }

  if (!(await can(session.tenantId, session.roleId, "invoices", "view"))) {
    return NextResponse.json({ error: "You don't have access to invoices" }, { status: 403 });
  }

  const { id } = await params;
  // Scoped by tenantId, so one tenant can't pull another's return file by guessing an id.
  const file = await prisma.gstJsonExport.findFirst({
    where: { id, tenantId: session.tenantId },
    select: { fileName: true, payload: true },
  });
  if (!file) return NextResponse.json({ error: "That JSON file could not be found." }, { status: 404 });

  return new NextResponse(file.payload, {
    headers: {
      "Content-Type": "application/json",
      "Content-Disposition": `attachment; filename="${file.fileName}"`,
    },
  });
}
