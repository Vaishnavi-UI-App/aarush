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

  const people = await prisma.orderedByPerson.findMany({
    where: { tenantId: session.tenantId },
    orderBy: { name: "asc" },
  });
  return NextResponse.json(people);
}

export async function POST(request: NextRequest) {
  let session;
  try {
    session = requireSession(request);
  } catch (e) {
    if (e instanceof SessionError) return NextResponse.json({ error: e.message }, { status: 401 });
    throw e;
  }

  const body = await request.json().catch(() => ({}));
  if (!body.name || typeof body.name !== "string") {
    return NextResponse.json({ error: "name is required" }, { status: 400 });
  }

  try {
    const person = await prisma.orderedByPerson.create({
      data: { tenantId: session.tenantId, name: body.name.trim() },
    });
    return NextResponse.json(person, { status: 201 });
  } catch {
    return NextResponse.json({ error: "That person already exists" }, { status: 409 });
  }
}
