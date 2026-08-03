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

  const categories = await prisma.expenseCategory.findMany({
    where: { tenantId: session.tenantId },
    orderBy: { name: "asc" },
  });
  return NextResponse.json(categories);
}

export async function POST(request: NextRequest) {
  let session;
  try {
    session = requireSession(request);
  } catch (e) {
    if (e instanceof SessionError) return NextResponse.json({ error: e.message }, { status: 401 });
    throw e;
  }
  // Any role can add a category inline from the expense form -- same reasoning as
  // expense creation itself: not a business-record edit, just extending a picklist.

  const body = await request.json().catch(() => ({}));
  if (!body.name || typeof body.name !== "string") {
    return NextResponse.json({ error: "name is required" }, { status: 400 });
  }

  try {
    const category = await prisma.expenseCategory.create({
      data: { tenantId: session.tenantId, name: body.name.trim() },
    });
    return NextResponse.json(category, { status: 201 });
  } catch {
    return NextResponse.json({ error: "That category already exists" }, { status: 409 });
  }
}
