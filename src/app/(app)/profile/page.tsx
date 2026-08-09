import { getServerSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import ProfileForm from "./ProfileForm";
import "./profile.css";

export default async function ProfilePage() {
  const session = await getServerSession();
  const user = await prisma.user.findUniqueOrThrow({
    where: { id: session!.userId },
    select: { name: true, email: true, phone: true, photoData: true, role: true, roleRef: { select: { name: true } } },
  });

  return (
    <div>
      <h1 className="afs-page-title">My Profile</h1>
      <p className="afs-page-subtitle">Your basic information -- visible to your organization's owner/admins</p>

      <div className="afs-card">
        <ProfileForm
          initialName={user.name ?? ""}
          email={user.email}
          initialPhone={user.phone ?? ""}
          initialPhoto={user.photoData}
          roleName={user.roleRef?.name ?? user.role.replace("_", " ")}
        />
      </div>
    </div>
  );
}
