import { NextRequest, NextResponse } from "next/server";
import { requireSession, SessionError } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { can } from "@/lib/permissions";
import { updateExpense, deleteExpense } from "@/lib/site-wallet";
import { getRestrictedSiteId } from "@/lib/expense-query";

/** True if this viewer is site-restricted and the expense belongs to a different site. */
async function isOutsideRestrictedSite(tenantId: string, userId: string, expenseId: string): Promise<boolean> {
  const restrictedSiteId = await getRestrictedSiteId(tenantId, userId);
  if (!restrictedSiteId) return false;
  const expense = await prisma.expense.findFirst({ where: { id: expenseId, tenantId }, select: { siteId: true } });
  return !expense || expense.siteId !== restrictedSiteId;
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  let session;
  try {
    session = requireSession(request);
  } catch (e) {
    if (e instanceof SessionError) return NextResponse.json({ error: e.message }, { status: 401 });
    throw e;
  }
  // Editing (as opposed to logging your own spend) requires the same permission that
  // unlocks the finance-wide expense view -- correcting someone else's entry is a
  // business-record edit, not a personal claim.
  if (!(await can(session.tenantId, session.roleId, "expenses", "edit"))) {
    return NextResponse.json({ error: "View-only access" }, { status: 403 });
  }

  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  if (!(body.amount > 0)) {
    return NextResponse.json({ error: "amount > 0 is required" }, { status: 400 });
  }
  if (await isOutsideRestrictedSite(session.tenantId, session.userId, id)) {
    return NextResponse.json({ error: "You can only edit expenses for your assigned site" }, { status: 403 });
  }

  try {
    const expense = await updateExpense({
      tenantId: session.tenantId,
      expenseId: id,
      amount: body.amount,
      categoryId: body.categoryId || undefined,
      orderedById: body.orderedById || undefined,
      date: body.date ? new Date(body.date) : undefined,
      note: body.note || undefined,
    });
    return NextResponse.json(expense);
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Could not update expense" }, { status: 400 });
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  let session;
  try {
    session = requireSession(request);
  } catch (e) {
    if (e instanceof SessionError) return NextResponse.json({ error: e.message }, { status: 401 });
    throw e;
  }
  if (!(await can(session.tenantId, session.roleId, "expenses", "delete"))) {
    return NextResponse.json({ error: "View-only access" }, { status: 403 });
  }

  const { id } = await params;
  if (await isOutsideRestrictedSite(session.tenantId, session.userId, id)) {
    return NextResponse.json({ error: "You can only delete expenses for your assigned site" }, { status: 403 });
  }

  try {
    await deleteExpense(session.tenantId, id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Could not delete expense" }, { status: 400 });
  }
}
