import { notFound } from "next/navigation";
import { getServerSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import EditCustomerForm from "./EditCustomerForm";

export default async function EditCustomerPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession();
  const { id } = await params;

  const customer = await prisma.customer.findFirst({ where: { id, tenantId: session!.tenantId } });
  if (!customer) notFound();

  return (
    <div>
      <h1 className="afs-page-title">Edit {customer.name}</h1>
      <p className="afs-page-subtitle">Update customer details</p>

      <div className="afs-card">
        <EditCustomerForm customer={customer} />
      </div>
    </div>
  );
}
