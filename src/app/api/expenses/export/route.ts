import { NextRequest, NextResponse } from "next/server";
import { requireSession, SessionError } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { can } from "@/lib/permissions";
import { buildExpenseWhere, getRestrictedSiteId } from "@/lib/expense-query";

function csvCell(value: string): string {
  return `"${value.replace(/"/g, '""')}"`;
}

export async function GET(request: NextRequest) {
  let session;
  try {
    session = requireSession(request);
  } catch (e) {
    if (e instanceof SessionError) return NextResponse.json({ error: e.message }, { status: 401 });
    throw e;
  }

  const params = request.nextUrl.searchParams;
  const siteId = params.get("siteId") || undefined;
  const from = params.get("from") || undefined;
  const to = params.get("to") || undefined;

  const addedById = (await can(session.tenantId, session.roleId, "expenses", "edit")) ? undefined : session.userId;
  const restrictedSiteId = await getRestrictedSiteId(session.tenantId, session.userId);

  const expenses = await prisma.expense.findMany({
    where: buildExpenseWhere({ tenantId: session.tenantId, siteId, from, to, addedById, restrictedSiteId }),
    include: {
      site: { select: { name: true } },
      category: { select: { name: true } },
      orderedBy: { select: { name: true } },
      addedBy: { select: { name: true, email: true } },
    },
    orderBy: { date: "desc" },
  });

  const header = ["Date", "Site", "Category", "Ordered By", "Amount", "Company Paid", "Personal Paid", "Split", "Added By", "Note"];
  const lines = [header.map(csvCell).join(",")];
  for (const e of expenses) {
    lines.push(
      [
        new Date(e.date).toLocaleDateString("en-IN"),
        e.site.name,
        e.category?.name ?? "Uncategorized",
        e.orderedBy?.name ?? "",
        Number(e.amount).toFixed(2),
        Number(e.companyPaid).toFixed(2),
        Number(e.personalPaid).toFixed(2),
        e.fundType,
        e.addedBy.name || e.addedBy.email,
        e.note ?? "",
      ]
        .map((v) => csvCell(String(v)))
        .join(",")
    );
  }
  // Leading BOM so Excel opens the UTF-8 CSV without mangling non-ASCII characters.
  const csv = "﻿" + lines.join("\r\n");

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="expenses-report-${new Date().toISOString().slice(0, 10)}.csv"`,
    },
  });
}
