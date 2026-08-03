import { NextRequest, NextResponse } from "next/server";
import { requireSession, SessionError } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { canAccessFinance } from "@/lib/permissions";

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  let session;
  try {
    session = requireSession(request);
  } catch (e) {
    if (e instanceof SessionError) return NextResponse.json({ error: e.message }, { status: 401 });
    throw e;
  }
  if (!(await canAccessFinance(session.tenantId, session.role))) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

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
