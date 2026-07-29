import { NextRequest, NextResponse } from "next/server";
import { requireSession, SessionError } from "@/lib/session";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  let session;
  try {
    session = requireSession(request);
  } catch (e) {
    if (e instanceof SessionError) return NextResponse.json({ error: e.message }, { status: 401 });
    throw e;
  }

  const accounts = await prisma.bankAccount.findMany({
    where: { tenantId: session.tenantId },
    orderBy: { createdAt: "asc" },
  });

  return NextResponse.json(accounts);
}

export async function POST(request: NextRequest) {
  let session;
  try {
    session = requireSession(request);
  } catch (e) {
    if (e instanceof SessionError) return NextResponse.json({ error: e.message }, { status: 401 });
    throw e;
  }

  const body = await request.json();
  if (!body.bankName || !body.accountNo || !body.ifsc) {
    return NextResponse.json({ error: "bankName, accountNo, ifsc are required" }, { status: 400 });
  }

  const account = await prisma.bankAccount.create({
    data: {
      tenantId: session.tenantId,
      bankName: body.bankName,
      accountNo: body.accountNo,
      ifsc: body.ifsc,
      branchName: body.branchName || null,
      openingBalance: body.openingBalance ?? 0,
    },
  });

  return NextResponse.json(account, { status: 201 });
}
