import { NextRequest, NextResponse } from "next/server";
import { requireSession, SessionError } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { canManageUsers } from "@/lib/permissions";

export async function PATCH(request: NextRequest) {
  let session;
  try {
    session = requireSession(request);
  } catch (e) {
    if (e instanceof SessionError) return NextResponse.json({ error: e.message }, { status: 401 });
    throw e;
  }
  if (!(await canManageUsers(session.tenantId, session.roleId))) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await request.json().catch(() => ({}));
  const { name, gstin, pan, cinNo, website, stateCode, invoicePrefix, addressLine, phone, email, bankAccountName, bankAccountNo, bankIfsc, bankName, bankBranch, invoiceTerms } = body;

  if (!name || !gstin || !stateCode) {
    return NextResponse.json({ error: "name, gstin, and stateCode are required" }, { status: 400 });
  }

  const tenant = await prisma.tenant.update({
    where: { id: session.tenantId },
    data: {
      name,
      gstin,
      pan: pan || null,
      cinNo: cinNo || null,
      website: website || null,
      stateCode,
      invoicePrefix: invoicePrefix || "INV",
      addressLine: addressLine || null,
      phone: phone || null,
      email: email || null,
      bankAccountName: bankAccountName || null,
      bankAccountNo: bankAccountNo || null,
      bankIfsc: bankIfsc || null,
      bankName: bankName || null,
      bankBranch: bankBranch || null,
      invoiceTerms: invoiceTerms || null,
    },
  });

  return NextResponse.json(tenant);
}
