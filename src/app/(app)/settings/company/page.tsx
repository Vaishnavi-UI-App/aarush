import { redirect } from "next/navigation";
import { getServerSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { canManageUsers } from "@/lib/permissions";
import CompanyDetailsForm from "./CompanyDetailsForm";

export default async function SettingsCompanyPage() {
  const session = await getServerSession();
  if (!(await canManageUsers(session!.tenantId, session!.role))) redirect("/dashboard");

  const tenant = await prisma.tenant.findUniqueOrThrow({ where: { id: session!.tenantId } });

  return (
    <div>
      <h1 className="afs-page-title">Settings — Company Details</h1>
      <p className="afs-page-subtitle">Business profile and bank account shown on invoice PDFs</p>

      <div className="afs-card">
        <CompanyDetailsForm tenant={tenant} />
      </div>
    </div>
  );
}
