import { notFound } from "next/navigation";
import { getServerSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import InvoiceTemplate from "@/components/InvoiceTemplate";
import { toInvoiceTemplateData } from "@/lib/invoice-to-template-data";
import "@/components/invoice.css";

export default async function PrintInvoicePage({ params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession();
  if (!session) notFound();

  const { id } = await params;

  const [invoice, tenant] = await Promise.all([
    prisma.invoice.findFirst({
      where: { id, tenantId: session.tenantId },
      include: { lines: true, customer: true },
    }),
    prisma.tenant.findUniqueOrThrow({ where: { id: session.tenantId } }),
  ]);

  if (!invoice) notFound();

  return <InvoiceTemplate invoice={toInvoiceTemplateData(invoice, tenant)} />;
}
