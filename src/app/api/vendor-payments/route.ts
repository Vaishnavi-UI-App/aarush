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

  const unmatchedOnly = request.nextUrl.searchParams.get("unmatched") === "true";

  const payments = await prisma.vendorPayment.findMany({
    where: {
      tenantId: session.tenantId,
      status: "SUCCESS",
      ...(unmatchedOnly ? { bankTransaction: null } : {}),
    },
    include: { vendor: { select: { name: true } } },
    orderBy: { date: "desc" },
  });

  return NextResponse.json(payments);
}
