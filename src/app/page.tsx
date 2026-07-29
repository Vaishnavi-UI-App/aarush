import { redirect } from "next/navigation";
import { getServerSession } from "@/lib/session";

export default async function Home() {
  const session = await getServerSession();
  redirect(session ? "/dashboard" : "/login");
}
