import { notFound } from "next/navigation";
import { getServerSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import PayslipTemplate, { PayslipTemplateData } from "@/components/PayslipTemplate";
import "@/components/payslip.css";

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

export default async function PrintPayslipPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession();
  if (!session) notFound();

  const { id } = await params;

  const [payslip, tenant] = await Promise.all([
    prisma.payslip.findFirst({
      where: { id, tenantId: session.tenantId },
      include: { user: { select: { name: true, email: true } } },
    }),
    prisma.tenant.findUniqueOrThrow({ where: { id: session.tenantId } }),
  ]);

  if (!payslip) notFound();

  const data: PayslipTemplateData = {
    company: {
      name: tenant.name,
      address: tenant.addressLine || "",
      logoUrl: tenant.logoUrl || "/logo.jpeg",
    },
    employee: { name: payslip.user.name || payslip.user.email, email: payslip.user.email },
    monthLabel: `${MONTH_NAMES[payslip.month - 1]} ${payslip.year}`,
    workingDays: Number(payslip.workingDays),
    presentDays: Number(payslip.presentDays),
    lopDays: Number(payslip.lopDays),
    earnings: {
      basic: Number(payslip.basic),
      hra: Number(payslip.hra),
      conveyance: Number(payslip.conveyance),
      medicalAllowance: Number(payslip.medicalAllowance),
      specialAllowance: Number(payslip.specialAllowance),
      gross: Number(payslip.grossEarnings),
    },
    deductions: {
      tds: Number(payslip.tds),
      professionalTax: Number(payslip.professionalTax),
      lopDeduction: Number(payslip.lopDeduction),
      otherDeductions: Number(payslip.otherDeductions),
      total: Number(payslip.totalDeductions),
    },
    reimbursements: Number(payslip.reimbursements),
    netPayable: Number(payslip.netPayable),
    generatedOn: new Date(payslip.updatedAt).toLocaleDateString("en-IN"),
  };

  return <PayslipTemplate data={data} />;
}
