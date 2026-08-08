import { NextRequest, NextResponse } from "next/server";
import { requireSession, SessionError } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { can } from "@/lib/permissions";
import { updateFundAllocation, deleteFundAllocation } from "@/lib/site-wallet";
import { getRestrictedSiteId } from "@/lib/expense-query";

async function isOutsideRestrictedSite(tenantId: string, userId: string, fundAllocationId: string): Promise<boolean> {
  const restrictedSiteId = await getRestrictedSiteId(tenantId, userId);
  if (!restrictedSiteId) return false;
  const fund = await prisma.fundAllocation.findFirst({ where: { id: fundAllocationId, tenantId }, select: { siteId: true } });
  return !fund || fund.siteId !== restrictedSiteId;
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ fundId: string }> }) {
  let session;
  try {
    session = requireSession(request);
  } catch (e) {
    if (e instanceof SessionError) return NextResponse.json({ error: e.message }, { status: 401 });
    throw e;
  }
  if (!(await can(session.tenantId, session.roleId, "sites", "edit"))) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { fundId } = await params;
  const body = await request.json().catch(() => ({}));
  if (!(body.amount > 0)) {
    return NextResponse.json({ error: "amount > 0 is required" }, { status: 400 });
  }
  if (await isOutsideRestrictedSite(session.tenantId, session.userId, fundId)) {
    return NextResponse.json({ error: "You can only edit funds for your assigned site" }, { status: 403 });
  }

  try {
    const allocation = await updateFundAllocation({
      tenantId: session.tenantId,
      fundAllocationId: fundId,
      amount: body.amount,
      note: body.note || undefined,
    });
    return NextResponse.json(allocation);
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Could not update fund allocation" }, { status: 400 });
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ fundId: string }> }) {
  let session;
  try {
    session = requireSession(request);
  } catch (e) {
    if (e instanceof SessionError) return NextResponse.json({ error: e.message }, { status: 401 });
    throw e;
  }
  if (!(await can(session.tenantId, session.roleId, "sites", "delete"))) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { fundId } = await params;
  if (await isOutsideRestrictedSite(session.tenantId, session.userId, fundId)) {
    return NextResponse.json({ error: "You can only delete funds for your assigned site" }, { status: 403 });
  }

  try {
    await deleteFundAllocation(session.tenantId, fundId);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Could not delete fund allocation" }, { status: 400 });
  }
}
