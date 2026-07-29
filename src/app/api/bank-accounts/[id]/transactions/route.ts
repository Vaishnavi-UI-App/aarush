import { NextRequest, NextResponse } from "next/server";
import { requireSession, SessionError } from "@/lib/session";
import { prisma } from "@/lib/prisma";

async function assertOwnedAccount(tenantId: string, accountId: string) {
  const account = await prisma.bankAccount.findFirst({ where: { id: accountId, tenantId } });
  return account;
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  let session;
  try {
    session = requireSession(request);
  } catch (e) {
    if (e instanceof SessionError) return NextResponse.json({ error: e.message }, { status: 401 });
    throw e;
  }

  const { id: accountId } = await params;
  const account = await assertOwnedAccount(session.tenantId, accountId);
  if (!account) return NextResponse.json({ error: "Bank account not found" }, { status: 404 });

  const transactions = await prisma.bankTransaction.findMany({
    where: { bankAccountId: accountId },
    orderBy: { date: "desc" },
    include: {
      matchedPayment: { select: { id: true, amount: true, customerId: true } },
      matchedVendorPayment: { select: { id: true, amount: true, vendorId: true } },
    },
  });

  return NextResponse.json(transactions);
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  let session;
  try {
    session = requireSession(request);
  } catch (e) {
    if (e instanceof SessionError) return NextResponse.json({ error: e.message }, { status: 401 });
    throw e;
  }

  const { id: accountId } = await params;
  const account = await assertOwnedAccount(session.tenantId, accountId);
  if (!account) return NextResponse.json({ error: "Bank account not found" }, { status: 404 });

  const body = await request.json();
  if (!body.date || !body.description || !(body.amount > 0) || (body.type !== "CREDIT" && body.type !== "DEBIT")) {
    return NextResponse.json({ error: "date, description, amount > 0, type (CREDIT|DEBIT) are required" }, { status: 400 });
  }

  const transaction = await prisma.bankTransaction.create({
    data: {
      bankAccountId: accountId,
      date: new Date(body.date),
      description: body.description,
      amount: body.amount,
      type: body.type,
    },
  });

  return NextResponse.json(transaction, { status: 201 });
}
