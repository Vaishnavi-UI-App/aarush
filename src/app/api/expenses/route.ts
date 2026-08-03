import { NextRequest, NextResponse } from "next/server";
import { requireSession, SessionError } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { canAccessFinance } from "@/lib/permissions";
import { recordExpense } from "@/lib/site-wallet";

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
  const addedById = (await canAccessFinance(session.tenantId, session.role)) ? undefined : session.userId;

  const expenses = await prisma.expense.findMany({
    where: {
      tenantId: session.tenantId,
      ...(siteId ? { siteId } : {}),
      ...(addedById ? { addedById } : {}),
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
