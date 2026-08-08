import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

async function main() {
  const tenantBusinessProfile = {
    name: "Aarush Fire Protection Systems Pvt. Ltd.",
    gstin: "27AAAAA0000A1Z5", // PLACEHOLDER -- replace with the real GSTIN
    pan: "AAAAA0000A", // PLACEHOLDER -- replace with the real PAN
    stateCode: "27", // Maharashtra
    invoicePrefix: "INV",
    addressLine: "Pune, Maharashtra", // PLACEHOLDER -- replace with the real registered address
    phone: "9999999999", // PLACEHOLDER
    email: "info@aarushfires.com", // PLACEHOLDER
    logoUrl: "/logo.jpeg",
    bankAccountName: "AARUSH FIRE PROTECTION SYSTEMS PVT LTD",
    bankAccountNo: "070110100000616",
    bankIfsc: "NKGS0000070",
    bankName: "NKGSB Co-op Bank Ltd",
    bankBranch: "Pune",
    invoiceTerms: "100% ADVANCE PAYMENT BEFORE DELIVERY.\nGST EXTRA.\nPACKING CHARGES EXTRA.\nTRANSPORT CHARGES EXTRA.",
  };

  const tenant = await prisma.tenant.upsert({
    where: { id: "00000000-0000-0000-0000-000000000001" },
    update: tenantBusinessProfile,
    create: {
      id: "00000000-0000-0000-0000-000000000001",
      ...tenantBusinessProfile,
    },
  });

  // The custom-roles system fails closed: no roleId means no page access at all
  // (see src/lib/permissions.ts), so the tenant's Owner role has to exist before
  // the owner user can do anything -- including see any sidebar link.
  const ownerRole = await prisma.role.upsert({
    where: { tenantId_name: { tenantId: tenant.id, name: "Owner" } },
    update: {},
    create: {
      tenantId: tenant.id,
      name: "Owner",
      isSystem: true,
      isOwner: true,
    },
  });

  const owner = await prisma.user.upsert({
    where: { id: "00000000-0000-0000-0000-000000000901" },
    update: { email: "aarushfireprotection@gmail.com", roleId: ownerRole.id },
    create: {
      id: "00000000-0000-0000-0000-000000000901",
      tenantId: tenant.id,
      name: "Owner",
      email: "aarushfireprotection@gmail.com",
      // Not a real hash of anything -- verifyPassword() only accepts "scrypt:..." values,
      // so this account can't log in until it goes through the forgot-password flow.
      passwordHash: "unset",
      role: "OWNER",
      roleId: ownerRole.id,
    },
  });

  // Same state as tenant (27, Maharashtra) -> exercises CGST/SGST.
  const customerSameState = await prisma.customer.upsert({
    where: { id: "00000000-0000-0000-0000-000000000101" },
    update: {},
    create: {
      id: "00000000-0000-0000-0000-000000000101",
      tenantId: tenant.id,
      name: "SRPRO TECHNOWORLD LLP",
      gstin: "27AESFS0962H1ZJ",
      stateCode: "27",
      address: "Pimpri Chinchwad, Pune, Maharashtra",
      email: "accounts@srpro.example",
      phone: "9545519101",
    },
  });

  // Different state (29, Karnataka) -> exercises IGST.
  const customerDifferentState = await prisma.customer.upsert({
    where: { id: "00000000-0000-0000-0000-000000000102" },
    update: {},
    create: {
      id: "00000000-0000-0000-0000-000000000102",
      tenantId: tenant.id,
      name: "Bengaluru Buildtech Pvt. Ltd.",
      gstin: "29AABCB1234C1Z8",
      stateCode: "29",
      address: "Whitefield, Bengaluru, Karnataka",
      email: "accounts@bengalurubuildtech.example",
      phone: "9900011122",
    },
  });

  const vendor = await prisma.vendor.upsert({
    where: { id: "00000000-0000-0000-0000-000000000301" },
    update: {},
    create: {
      id: "00000000-0000-0000-0000-000000000301",
      tenantId: tenant.id,
      name: "Raw Materials Supply Co.",
      gstin: "27AAACR1234D1Z9",
      stateCode: "27",
      address: "MIDC, Pune, Maharashtra",
      email: "sales@rawmaterialssupply.example",
      phone: "9812345678",
    },
  });

  const bankAccount = await prisma.bankAccount.upsert({
    where: { id: "00000000-0000-0000-0000-000000000401" },
    update: {},
    create: {
      id: "00000000-0000-0000-0000-000000000401",
      tenantId: tenant.id,
      bankName: "Bank of Baroda",
      accountNo: "39310400000093",
      ifsc: "BARB0SATPUN",
      branchName: "SATARA ROAD",
      openingBalance: 0,
    },
  });

  const items = await Promise.all([
    prisma.item.upsert({
      where: { id: "00000000-0000-0000-0000-000000000201" },
      update: {},
      create: {
        id: "00000000-0000-0000-0000-000000000201",
        tenantId: tenant.id,
        name: "Fire Bucket With Handle",
        hsnCode: "73102990",
        unit: "NOS",
        salePrice: 200,
        purchasePrice: 150,
        taxRate: 5,
      },
    }),
    prisma.item.upsert({
      where: { id: "00000000-0000-0000-0000-000000000202" },
      update: {},
      create: {
        id: "00000000-0000-0000-0000-000000000202",
        tenantId: tenant.id,
        name: "Smoke Detector (Conventional)",
        hsnCode: "853110",
        unit: "NOS",
        salePrice: 290,
        purchasePrice: 210,
        taxRate: 12,
      },
    }),
    prisma.item.upsert({
      where: { id: "00000000-0000-0000-0000-000000000203" },
      update: {},
      create: {
        id: "00000000-0000-0000-0000-000000000203",
        tenantId: tenant.id,
        name: "4 KG ABC Type Fire Extinguisher",
        hsnCode: "84241000",
        unit: "NOS",
        salePrice: 640,
        purchasePrice: 480,
        taxRate: 18,
      },
    }),
  ]);

  // Tenant-wide default shift (roleId: null) -- resolveShiftConfig() in lib/attendance.ts
  // would auto-provision this on first use anyway, but seeding it here means a fresh
  // tenant's Settings -> Shift Rules screen shows a real, editable row from day one.
  // Plain findFirst + create/update, not upsert: roleId is part of the compound unique
  // index, and Prisma's upsert rejects a literal null there.
  const existingDefaultShift = await prisma.shiftConfig.findFirst({ where: { tenantId: tenant.id, roleId: null } });
  const defaultShift = existingDefaultShift
    ? existingDefaultShift
    : await prisma.shiftConfig.create({
        data: {
          tenantId: tenant.id,
          roleId: null,
          name: "Default Shift",
          startTime: "09:30",
          endTime: "18:30",
          gracePeriodMins: 10,
          halfDayThresholdHrs: 4,
          fullDayThresholdHrs: 8,
          overtimeAfterHrs: 9,
        },
      });

  console.log("Seeded:");
  console.log("  tenant:", tenant.name, tenant.id);
  console.log("  owner user:", owner.email, owner.id);
  console.log("  customers:", customerSameState.name, "(same state)", "/", customerDifferentState.name, "(different state)");
  console.log("  items:", items.map((i) => `${i.name} @ ${i.taxRate}%`).join(", "));
  console.log("  vendor:", vendor.name, vendor.id);
  console.log("  bank account:", bankAccount.bankName, bankAccount.accountNo);
  console.log("  default shift:", defaultShift.name, `${defaultShift.startTime}-${defaultShift.endTime}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
