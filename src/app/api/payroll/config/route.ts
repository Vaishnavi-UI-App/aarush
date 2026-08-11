import { NextRequest, NextResponse } from "next/server";
import { requireSession, SessionError } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { canManageUsers } from "@/lib/permissions";
import { getOrCreatePayrollConfig } from "@/lib/payroll";

export async function GET(request: NextRequest) {
  let session;
  try {
    session = requireSession(request);
  } catch (e) {
    if (e instanceof SessionError) return NextResponse.json({ error: e.message }, { status: 401 });
    throw e;
  }
  if (!(await canManageUsers(session.tenantId, session.roleId))) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const config = await getOrCreatePayrollConfig(session.tenantId);
  return NextResponse.json(config);
}

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
  const fields = ["basicPercent", "hraPercent", "conveyancePercent", "medicalPercent", "specialAllowancePercent", "professionalTax"] as const;
  const data: Record<string, number> = {};
  for (const f of fields) {
    if (body[f] !== undefined) {
      if (typeof body[f] !== "number" || body[f] < 0) {
        return NextResponse.json({ error: `${f} must be a non-negative number` }, { status: 400 });
      }
      data[f] = body[f];
    }
  }

  await getOrCreatePayrollConfig(session.tenantId);
  const updated = await prisma.payrollConfig.update({ where: { tenantId: session.tenantId }, data });
  return NextResponse.json(updated);
}
