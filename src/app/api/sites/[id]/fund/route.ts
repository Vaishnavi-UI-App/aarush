import { NextRequest, NextResponse } from "next/server";
import { requireSession, SessionError } from "@/lib/session";
import { canAccessFinance } from "@/lib/permissions";
import { fundSite } from "@/lib/site-wallet";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  let session;
  try {
    session = requireSession(request);
  } catch (e) {
    if (e instanceof SessionError) return NextResponse.json({ error: e.message }, { status: 401 });
    throw e;
  }
  if (!(await canAccessFinance(session.tenantId, session.role))) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  if (!(body.amount > 0)) {
    return NextResponse.json({ error: "amount > 0 is required" }, { status: 400 });
  }

  try {
    const allocation = await fundSite({
      tenantId: session.tenantId,
      siteId: id,
      addedById: session.userId,
      amount: body.amount,
      note: body.note || undefined,
    });
    return NextResponse.json(allocation, { status: 201 });
  } catch (e) {
    console.error("Failed to fund site:", e);
    return NextResponse.json({ error: e instanceof Error ? e.message : "Could not fund site" }, { status: 400 });
  }
}
