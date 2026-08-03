import { Prisma, Tenant } from "@/generated/prisma/client";
import { DeliveryChallanData, DeliveryChallanLineItem } from "@/lib/delivery-challan-types";

type ChallanWithRelations = Prisma.DeliveryChallanGetPayload<{
  include: { lines: true; customer: true };
}>;

function formatDate(d: Date): string {
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }).replace(/ /g, "/");
}

/** Maps a real, persisted delivery challan + its owning tenant into the shape the
 * printable DeliveryChallanTemplate expects. Contact/branch furniture (tagline,
 * registered office, branch list) isn't tenant-configurable data yet -- it mirrors
 * the tenant's actual printed letterhead, same as the invoice template's fixed
 * "Thankyou for your business" line. */
export function toDeliveryChallanTemplateData(challan: ChallanWithRelations, tenant: Tenant): DeliveryChallanData {
  const lines: DeliveryChallanLineItem[] = challan.lines
    .sort((a, b) => a.srNo - b.srNo)
    .map((line) => ({
      srNo: line.srNo,
      particulars: line.particulars,
      qty: Number(line.qty),
    }));

  const totalQty = lines.reduce((sum, l) => sum + l.qty, 0);

  return {
    challanNumber: challan.number,
    date: formatDate(new Date(challan.date)),
    poNumber: challan.poNumber ?? undefined,
    poDate: challan.poDate ? formatDate(new Date(challan.poDate)) : undefined,
    vehicleNumber: challan.vehicleNumber ?? undefined,
    toName: challan.toName ?? challan.customer?.name,
    toAddress: challan.toAddress ?? challan.customer?.address ?? undefined,

    seller: {
      name: tenant.name,
      tagline: "Protecting People, Premises & Productivity - Beyond Compliances",
      gstin: tenant.gstin,
      logoUrl: tenant.logoUrl ?? "/logo.jpeg",
      email: tenant.email ?? "director.aarushfire@gmail.com / aarushfire@gmail.com",
      phone: tenant.phone ?? "+91 95455 19101 / 73877 19101 / 77190 80101",
      website: "www.aarushfires.com",
      registeredOffice: "1, Devraj Heights, S. No. 13/5, Willam Nagar, Pimple Gurav, Pune-61.",
      branches: "Mumbai, Nashik, Aurangabad, Kolhapur, Ahmednagar & Sangamner.",
    },

    lines,
    totalQty,
  };
}
