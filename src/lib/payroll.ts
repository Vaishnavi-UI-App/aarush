import { prisma } from "@/lib/prisma";
import { round2 } from "@/lib/gst-invoice";

/** Calendar days in a month minus Sundays (the only weekly-off concept this app has --
 * there's no holiday calendar yet). UTC-based on purpose, same reasoning as
 * attendanceDateBucket in lib/attendance.ts: day-of-week math must not depend on the
 * server process's local timezone. */
export function workingDaysInMonth(year: number, month: number): number {
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  let sundays = 0;
  for (let d = 1; d <= daysInMonth; d++) {
    if (new Date(Date.UTC(year, month - 1, d)).getUTCDay() === 0) sundays++;
  }
  return daysInMonth - sundays;
}

/** PRESENT/LEAVE/HOLIDAY count as a full paid day, HALF_DAY as half, ABSENT (or no
 * record at all for a working day) contributes nothing -- the caller derives LOP days
 * as workingDays - presentDays, so a day with no attendance record at all is implicitly
 * unpaid, same as an explicit ABSENT. */
export async function computePresentDays(tenantId: string, userId: string, year: number, month: number): Promise<number> {
  const start = new Date(Date.UTC(year, month - 1, 1));
  const end = new Date(Date.UTC(year, month, 1));
  const records = await prisma.attendanceRecord.findMany({
    where: { tenantId, userId, date: { gte: start, lt: end } },
    select: { status: true },
  });
  let presentDays = 0;
  for (const r of records) {
    if (r.status === "PRESENT" || r.status === "LEAVE" || r.status === "HOLIDAY") presentDays += 1;
    else if (r.status === "HALF_DAY") presentDays += 0.5;
  }
  return round2(presentDays);
}

export async function getOrCreatePayrollConfig(tenantId: string) {
  const existing = await prisma.payrollConfig.findUnique({ where: { tenantId } });
  if (existing) return existing;
  return prisma.payrollConfig.create({ data: { tenantId } });
}

export interface PayslipComputed {
  workingDays: number;
  presentDays: number;
  lopDays: number;
  basic: number;
  hra: number;
  conveyance: number;
  medicalAllowance: number;
  specialAllowance: number;
  grossEarnings: number;
  tds: number;
  professionalTax: number;
  lopDeduction: number;
  otherDeductions: number;
  totalDeductions: number;
  reimbursements: number;
  netPayable: number;
}

/** Builds the default numbers for a payslip from the employee's monthlySalary, the
 * tenant's PayrollConfig percentages, and that month's attendance -- every one of these
 * numbers is just a starting point the admin can then hand-edit before finalizing. */
export async function computePayslipDefaults(tenantId: string, userId: string, year: number, month: number): Promise<PayslipComputed> {
  const [user, config, presentDays] = await Promise.all([
    prisma.user.findFirstOrThrow({ where: { id: userId, tenantId } }),
    getOrCreatePayrollConfig(tenantId),
    computePresentDays(tenantId, userId, year, month),
  ]);

  const monthlySalary = user.monthlySalary != null ? Number(user.monthlySalary) : 0;
  const workingDays = workingDaysInMonth(year, month);
  const lopDays = round2(Math.max(0, workingDays - presentDays));

  const basic = round2((monthlySalary * Number(config.basicPercent)) / 100);
  const hra = round2((monthlySalary * Number(config.hraPercent)) / 100);
  const conveyance = round2((monthlySalary * Number(config.conveyancePercent)) / 100);
  const medicalAllowance = round2((monthlySalary * Number(config.medicalPercent)) / 100);
  const specialAllowance = round2((monthlySalary * Number(config.specialAllowancePercent)) / 100);
  const grossEarnings = round2(basic + hra + conveyance + medicalAllowance + specialAllowance);

  const professionalTax = Number(config.professionalTax);
  const lopDeduction = workingDays > 0 ? round2((grossEarnings / workingDays) * lopDays) : 0;
  const tds = 0;
  const otherDeductions = 0;
  const totalDeductions = round2(tds + professionalTax + lopDeduction + otherDeductions);

  const reimbursements = 0;
  const netPayable = round2(grossEarnings - totalDeductions + reimbursements);

  return {
    workingDays,
    presentDays,
    lopDays,
    basic,
    hra,
    conveyance,
    medicalAllowance,
    specialAllowance,
    grossEarnings,
    tds,
    professionalTax,
    lopDeduction,
    otherDeductions,
    totalDeductions,
    reimbursements,
    netPayable,
  };
}

/** Creates a DRAFT payslip for (userId, year, month) if none exists yet, or refreshes
 * an existing DRAFT's numbers from current salary/attendance data. Never touches a
 * FINALIZED payslip -- that's only ever changed via an explicit reopen. */
export async function generateOrRefreshDraftPayslip(tenantId: string, userId: string, year: number, month: number) {
  const existing = await prisma.payslip.findUnique({
    where: { tenantId_userId_year_month: { tenantId, userId, year, month } },
  });
  if (existing && existing.status === "FINALIZED") return existing;

  const computed = await computePayslipDefaults(tenantId, userId, year, month);

  return prisma.payslip.upsert({
    where: { tenantId_userId_year_month: { tenantId, userId, year, month } },
    create: { tenantId, userId, year, month, ...computed },
    update: { ...computed },
  });
}
