import { NextRequest, NextResponse } from "next/server";
import { requireSession, SessionError } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { can } from "@/lib/permissions";
import { recordExpense } from "@/lib/site-wallet";
import { buildExpenseWhere, getRestrictedSiteId } from "@/lib/expense-query";

export async function GET(request: NextRequest) {
  let session;
  try {
    session = requireSession(request);
  } catch (e) {
    if (e instanceof SessionError) return NextResponse.json({ error: e.message }, { status: 401 });
    throw e;
  }

  const params = request.nextUrl.searchParams;
  const siteId = params.get("siteId") || undefined;
  const from = params.get("from") || undefined;
  const to = params.get("to") || undefined;

  // Non-finance roles are forced to their own expenses server-side, no matter what
  // addedById/userId they pass in the query string -- same self-scoping proven for
  // /api/attendance.
  const addedById = (await can(session.tenantId, session.roleId, "expenses", "edit")) ? undefined : session.userId;
  const restrictedSiteId = await getRestrictedSiteId(session.tenantId, session.userId);

  const expenses = await prisma.expense.findMany({
    where: buildExpenseWhere({ tenantId: session.tenantId, siteId, from, to, addedById, restrictedSiteId }),
    include: {
      site: { select: { id: true, name: true } },
      category: { select: { id: true, name: true } },
      orderedBy: { select: { id: true, name: true } },
      addedBy: { select: { id: true, name: true, email: true } },
    },
    orderBy: { date: "desc" },
  });

  return NextResponse.json(expenses);
}

export async function POST(request: NextRequest) {
  let session;
  try {
    session = requireSession(request);
  } catch (e) {
    if (e instanceof SessionError) return NextResponse.json({ error: e.message }, { status: 401 });
    throw e;
  }
  // Deliberately no canWrite() gate -- logging your own reimbursable spend is a personal
  // claim, not an edit to a business record, so it's open to every role including AUDITOR.

  const body = await request.json().catch(() => ({}));
  if (!body.siteId || !(body.amount > 0)) {
    return NextResponse.json({ error: "siteId and amount > 0 are required" }, { status: 400 });
  }

  const restrictedSiteId = await getRestrictedSiteId(session.tenantId, session.userId);
  if (restrictedSiteId && body.siteId !== restrictedSiteId) {
    return NextResponse.json({ error: "You can only log expenses for your assigned site" }, { status: 403 });
  }

  try {
    const expense = await recordExpense({
      tenantId: session.tenantId,
      siteId: body.siteId,
      addedById: session.userId,
      amount: body.amount,
      categoryId: body.categoryId || undefined,
      orderedById: body.orderedById || undefined,
      date: body.date ? new Date(body.date) : undefined,
      note: body.note || undefined,
      receiptPhotoData: body.receiptPhotoData || undefined,
    });
    return NextResponse.json(expense, { status: 201 });
  } catch (e) {
    console.error("Failed to record expense:", e);
    return NextResponse.json({ error: e instanceof Error ? e.message : "Could not record expense" }, { status: 400 });
  }
}
