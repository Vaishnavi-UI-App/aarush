import { redirect } from "next/navigation";

/** Accounts is a section, not a page of its own -- Sales is its first report. */
export default function AccountsPage() {
  redirect("/accounts/sales");
}
