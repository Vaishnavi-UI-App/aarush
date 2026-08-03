import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { financialYearLabel } from "@/lib/gst-invoice";

export interface DeliveryChallanLineInput {
  particulars: string;
  qty: number;
}

export interface CreateDeliveryChallanInput {
  tenantId: string;
  customerId?: string;
  toName?: string;
  toAddress?: string;
  poNumber?: string;
  poDate?: Date;
  vehicleNumber?: string;
  lines: DeliveryChallanLineInput[];
}

async function nextChallanNumber(tx: Prisma.TransactionClient, tenantId: string, date: Date): Promise<string> {
  // Serialize challan numbering per tenant so two concurrent requests never get the same sequence.
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${tenantId} || ':challan'))`;

  const fy = financialYearLabel(date);

  const counter = await tx.deliveryChallanCounter.upsert({
    where: { tenantId_financialYear: { tenantId, financialYear: fy } },
    create: { tenantId, financialYear: fy, lastSequence: 1 },
    update: { lastSequence: { increment: 1 } },
  });

  return `DC/${fy}/${counter.lastSequence}`;
}

export async function createDeliveryChallan(input: CreateDeliveryChallanInput) {
  const { tenantId, customerId, toName, toAddress, poNumber, poDate, vehicleNumber, lines } = input;

  if (lines.length === 0) {
    throw new Error("Delivery challan must have at least one line item");
  }

  return prisma.$transaction(async (tx) => {
    if (customerId) {
      await tx.customer.findFirstOrThrow({ where: { id: customerId, tenantId } });
    }

    const date = new Date();
    const number = await nextChallanNumber(tx, tenantId, date);

    return tx.deliveryChallan.create({
      data: {
        tenantId,
        customerId,
        number,
        date,
        toName,
        toAddress,
        poNumber,
        poDate,
        vehicleNumber,
        lines: {
          create: lines.map((line, i) => ({
            srNo: i + 1,
            particulars: line.particulars,
            qty: line.qty,
          })),
        },
      },
      include: { lines: true },
    });
  });
}
