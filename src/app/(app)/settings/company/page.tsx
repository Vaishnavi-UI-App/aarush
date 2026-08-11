import { redirect } from "next/navigation";
import { getServerSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { canManageUsers } from "@/lib/permissions";
import CompanyDetailsForm from "./CompanyDetailsForm";
import CompanyDocumentsSection from "./CompanyDocumentsSection";

export default async function SettingsCompanyPage() {
  const session = await getServerSession();
  if (!(await canManageUsers(session!.tenantId, session!.roleId))) redirect("/dashboard");

  const [tenant, documents] = await Promise.all([
    prisma.tenant.findUniqueOrThrow({ where: { id: session!.tenantId } }),
    prisma.companyDocument.findMany({
      where: { tenantId: session!.tenantId },
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
    }),
  ]);

  return (
    <div>
      <h1 className="afs-page-title">Settings — Organization Details</h1>
      <p className="afs-page-subtitle">Business profile and bank account shown on invoice PDFs</p>

      <div className="afs-card" style={{ marginBottom: 20 }}>
        <CompanyDetailsForm tenant={tenant} />
      </div>

      <div className="afs-card">
        <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 4 }}>Company Documents</h2>
        <p style={{ fontSize: 13, color: "#667", marginBottom: 16 }}>
          Policy letters, letterhead, certificates -- any file type, up to 25MB.
        </p>
        <CompanyDocumentsSection
          initialDocuments={documents.map((d) => ({ ...d, createdAt: d.createdAt.toISOString() }))}
        />
      </div>
    </div>
  );
}
