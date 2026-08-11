import { notFound, redirect } from "next/navigation";
import { getServerSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { canManageUsers } from "@/lib/permissions";
import PayslipEditForm from "./PayslipEditForm";

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

export default async function PayslipDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession();
  if (!(await canManageUsers(session!.tenantId, session!.roleId))) redirect("/dashboard");

  const { id } = await params;
  const payslip = await prisma.payslip.findFirst({
    where: { id, tenantId: session!.tenantId },
    include: { user: { select: { name: true, email: true } }, finalizedBy: { select: { name: true, email: true } } },
  });
  if (!payslip) notFound();

  return (
    <div>
      <h1 className="afs-page-title">
        Payslip &mdash; {payslip.user.name || payslip.user.email} &mdash; {MONTH_NAMES[payslip.month - 1]} {payslip.year}
      </h1>
      <p className="afs-page-subtitle">
        {payslip.status === "FINALIZED"
          ? `Finalized${payslip.finalizedBy ? ` by ${payslip.finalizedBy.name || payslip.finalizedBy.email}` : ""}${payslip.emailedAt ? " and emailed" : ""}`
          : "Draft -- review and edit before finalizing"}
      </p>

      <PayslipEditForm
        payslip={{
          id: payslip.id,
          status: payslip.status,
          workingDays: Number(payslip.workingDays),
          presentDays: Number(payslip.presentDays),
          lopDays: Number(payslip.lopDays),
          basic: Number(payslip.basic),
          hra: Number(payslip.hra),
          conveyance: Number(payslip.conveyance),
          medicalAllowance: Number(payslip.medicalAllowance),
          specialAllowance: Number(payslip.specialAllowance),
          grossEarnings: Number(payslip.grossEarnings),
          tds: Number(payslip.tds),
          professionalTax: Number(payslip.professionalTax),
          lopDeduction: Number(payslip.lopDeduction),
          otherDeductions: Number(payslip.otherDeductions),
          totalDeductions: Number(payslip.totalDeductions),
          reimbursements: Number(payslip.reimbursements),
          netPayable: Number(payslip.netPayable),
        }}
      />
    </div>
  );
}
