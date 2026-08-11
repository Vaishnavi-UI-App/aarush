import { NextRequest, NextResponse } from "next/server";
import { requireSession, SessionError } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { canManageUsers } from "@/lib/permissions";
import { generateOrRefreshDraftPayslip } from "@/lib/payroll";

/** Lists every active employee for the given month, alongside their payslip if one
 * exists. A DRAFT is auto-generated/refreshed from current salary+attendance for every
 * employee who has a monthlySalary set and doesn't already have a FINALIZED slip for
 * that month -- so the list always shows current numbers without a separate "Generate"
 * step, while never silently overwriting something already finalized. */
export async function GET(request: NextRequest) {
  let session;
  try {
    session = requireSession(request);
  } catch (e) {
    if (e instanceof SessionError) return NextResponse.json({ error: e.message }, { status: 401 });
    throw e;
  }
  if (!(await canManageUsers(session.tenantId, session.roleId))) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const year = parseInt(request.nextUrl.searchParams.get("year") || "", 10);
  const month = parseInt(request.nextUrl.searchParams.get("month") || "", 10);
  if (!year || !month || month < 1 || month > 12) {
    return NextResponse.json({ error: "year and month (1-12) are required" }, { status: 400 });
  }

  const users = await prisma.user.findMany({
    where: { tenantId: session.tenantId, archivedAt: null },
    select: { id: true, name: true, email: true, monthlySalary: true },
    orderBy: { name: "asc" },
  });

  const rows = await Promise.all(
    users.map(async (u) => {
      if (u.monthlySalary == null) {
        return { user: { id: u.id, name: u.name, email: u.email }, payslip: null, needsSalary: true };
      }
      const payslip = await generateOrRefreshDraftPayslip(session!.tenantId, u.id, year, month);
      return { user: { id: u.id, name: u.name, email: u.email }, payslip, needsSalary: false };
    })
  );

  return NextResponse.json(rows);
}
