import { NextRequest, NextResponse } from "next/server";
import { requireSession, SessionError } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { canManageUsers } from "@/lib/permissions";
import { round2 } from "@/lib/gst-invoice";

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  let session;
  try {
    session = requireSession(request);
  } catch (e) {
    if (e instanceof SessionError) return NextResponse.json({ error: e.message }, { status: 401 });
    throw e;
  }
  if (!(await canManageUsers(session.tenantId, session.roleId))) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  const payslip = await prisma.payslip.findFirst({
    where: { id, tenantId: session.tenantId },
    include: { user: { select: { id: true, name: true, email: true } } },
  });
  if (!payslip) return NextResponse.json({ error: "Payslip not found" }, { status: 404 });
  return NextResponse.json(payslip);
}

const EDITABLE_FIELDS = [
  "workingDays",
  "presentDays",
  "lopDays",
  "basic",
  "hra",
  "conveyance",
  "medicalAllowance",
  "specialAllowance",
  "tds",
  "professionalTax",
  "lopDeduction",
  "otherDeductions",
  "reimbursements",
] as const;

/** Every earning/deduction line is directly editable, but grossEarnings/totalDeductions/
 * netPayable are always recomputed server-side from those lines rather than accepted as
 * independent overrides -- so a hand-edited slip can never end up with a net payable
 * that doesn't actually add up to what's printed above it. */
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  let session;
  try {
    session = requireSession(request);
  } catch (e) {
    if (e instanceof SessionError) return NextResponse.json({ error: e.message }, { status: 401 });
    throw e;
  }
  if (!(await canManageUsers(session.tenantId, session.roleId))) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  const existing = await prisma.payslip.findFirst({ where: { id, tenantId: session.tenantId } });
  if (!existing) return NextResponse.json({ error: "Payslip not found" }, { status: 404 });
  if (existing.status === "FINALIZED") {
    return NextResponse.json({ error: "This payslip is finalized -- reopen it first to make changes" }, { status: 400 });
  }

  const body = await request.json().catch(() => ({}));
  const updates: Record<string, number> = {};
  for (const f of EDITABLE_FIELDS) {
    if (body[f] !== undefined) {
      if (typeof body[f] !== "number" || Number.isNaN(body[f])) {
        return NextResponse.json({ error: `${f} must be a number` }, { status: 400 });
      }
      updates[f] = body[f];
    }
  }

  const merged = { ...existing, ...updates } as Record<string, unknown>;
  const num = (k: string) => Number(merged[k]);
  const grossEarnings = round2(num("basic") + num("hra") + num("conveyance") + num("medicalAllowance") + num("specialAllowance"));
  const totalDeductions = round2(num("tds") + num("professionalTax") + num("lopDeduction") + num("otherDeductions"));
  const netPayable = round2(grossEarnings - totalDeductions + num("reimbursements"));

  const updated = await prisma.payslip.update({
    where: { id },
    data: { ...updates, grossEarnings, totalDeductions, netPayable },
    include: { user: { select: { id: true, name: true, email: true } } },
  });

  return NextResponse.json(updated);
}
