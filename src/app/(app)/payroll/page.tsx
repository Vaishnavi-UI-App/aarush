import { redirect } from "next/navigation";
import { getServerSession } from "@/lib/session";
import { canManageUsers } from "@/lib/permissions";
import PayrollDashboard from "./PayrollDashboard";

export default async function PayrollPage() {
  const session = await getServerSession();
  if (!(await canManageUsers(session!.tenantId, session!.roleId))) redirect("/dashboard");

  return <PayrollDashboard />;
}
