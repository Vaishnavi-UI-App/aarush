import { redirect } from "next/navigation";
import { getServerSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { canManageUsers } from "@/lib/permissions";
import ShiftConfigManager from "./ShiftConfigManager";

export default async function SettingsAttendancePage() {
  const session = await getServerSession();
  if (!(await canManageUsers(session!.tenantId, session!.roleId))) redirect("/dashboard");

  const [shifts, roles] = await Promise.all([
    prisma.shiftConfig.findMany({
      where: { tenantId: session!.tenantId },
      include: { role: { select: { id: true, name: true } } },
      orderBy: [{ roleId: "asc" }, { createdAt: "asc" }],
    }),
    prisma.role.findMany({
      where: { tenantId: session!.tenantId, isOwner: false },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
  ]);

  const shiftsForClient = shifts.map((s) => ({
    id: s.id,
    name: s.name,
    roleId: s.roleId,
    roleName: s.role?.name ?? null,
    startTime: s.startTime,
    endTime: s.endTime,
    gracePeriodMins: s.gracePeriodMins,
    halfDayThresholdHrs: Number(s.halfDayThresholdHrs),
    fullDayThresholdHrs: Number(s.fullDayThresholdHrs),
    overtimeAfterHrs: Number(s.overtimeAfterHrs),
  }));

  return (
    <div>
      <h1 className="afs-page-title">Settings — Shift Rules</h1>
      <p className="afs-page-subtitle">
        Configure shift timing, grace period, and half/full-day thresholds. One default applies to everyone; add a
        role-specific shift to override it.
      </p>

      <div className="afs-card" style={{ marginTop: 20 }}>
        <ShiftConfigManager shifts={shiftsForClient} roles={roles} />
      </div>
    </div>
  );
}
