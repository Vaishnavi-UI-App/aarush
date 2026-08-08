import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";

export interface ExpenseFilterParams {
  tenantId: string;
  siteId?: string;
  from?: string;
  to?: string;
  addedById?: string;
  // A site-assigned user's own site -- always wins over the client-supplied siteId, so
  // a site-restricted viewer can't see (or filter their way into) another site's data
  // just by passing a different siteId query param.
  restrictedSiteId?: string;
}

/** Shared by the expenses list API, the CSV export, and the print/PDF report --
 * one filter definition so all three always agree on what "this report" means. */
export function buildExpenseWhere({ tenantId, siteId, from, to, addedById, restrictedSiteId }: ExpenseFilterParams): Prisma.ExpenseWhereInput {
  return {
    tenantId,
    ...(restrictedSiteId ? { siteId: restrictedSiteId } : siteId ? { siteId } : {}),
    ...(addedById ? { addedById } : {}),
    ...(from || to
      ? {
          date: {
            ...(from ? { gte: new Date(from) } : {}),
            ...(to ? { lte: new Date(to) } : {}),
          },
        }
      : {}),
  };
}

/** A user's assigned site, if any -- undefined means unrestricted (sees every site). */
export async function getRestrictedSiteId(tenantId: string, userId: string): Promise<string | undefined> {
  const user = await prisma.user.findFirst({ where: { id: userId, tenantId }, select: { siteId: true } });
  return user?.siteId ?? undefined;
}
