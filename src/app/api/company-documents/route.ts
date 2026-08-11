import { NextRequest, NextResponse } from "next/server";
import { requireSession, SessionError } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { canManageUsers } from "@/lib/permissions";

// Stored as base64 in a Postgres text column (see schema comment on CompanyDocument) --
// there's no hard technical ceiling on that, but an unbounded upload is still a bad idea
// (one huge file could bloat the DB and slow every query that touches this table), so
// this caps it at a size generous enough for any real policy doc/letterhead/certificate.
const MAX_FILE_SIZE_BYTES = 25 * 1024 * 1024;

export async function GET(request: NextRequest) {
  let session;
  try {
    session = requireSession(request);
  } catch (e) {
    if (e instanceof SessionError) return NextResponse.json({ error: e.message }, { status: 401 });
    throw e;
  }
  if (!(await canManageUsers(session.tenantId, session.roleId))) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const documents = await prisma.companyDocument.findMany({
    where: { tenantId: session.tenantId },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      title: true,
      fileName: true,
      mimeType: true,
      fileSize: true,
      createdAt: true,
      uploadedBy: { select: { name: true, email: true } },
    },
  });

  return NextResponse.json(documents);
}

export async function POST(request: NextRequest) {
  let session;
  try {
    session = requireSession(request);
  } catch (e) {
    if (e instanceof SessionError) return NextResponse.json({ error: e.message }, { status: 401 });
    throw e;
  }
  if (!(await canManageUsers(session.tenantId, session.roleId))) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const form = await request.formData().catch(() => null);
  const title = form?.get("title");
  const file = form?.get("file");

  if (!title || typeof title !== "string" || !title.trim()) {
    return NextResponse.json({ error: "Title is required" }, { status: 400 });
  }
  if (!file || !(file instanceof File) || file.size === 0) {
    return NextResponse.json({ error: "A file is required" }, { status: 400 });
  }
  if (file.size > MAX_FILE_SIZE_BYTES) {
    return NextResponse.json({ error: `File is too large -- max ${MAX_FILE_SIZE_BYTES / (1024 * 1024)}MB` }, { status: 400 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const document = await prisma.companyDocument.create({
    data: {
      tenantId: session.tenantId,
      title: title.trim(),
      fileName: file.name || "document",
      mimeType: file.type || "application/octet-stream",
      fileSize: file.size,
      fileData: buffer.toString("base64"),
      uploadedById: session.userId,
    },
    select: {
      id: true,
      title: true,
      fileName: true,
      mimeType: true,
      fileSize: true,
      createdAt: true,
      uploadedBy: { select: { name: true, email: true } },
    },
  });

  return NextResponse.json(document, { status: 201 });
}
