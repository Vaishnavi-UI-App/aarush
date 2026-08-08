// Pure types/constants only -- no server-only imports (prisma etc.) here, so this file
// is safe to import from client components, the same way permission-keys.ts was.

export type PageKey =
  | "dashboard"
  | "invoices"
  | "deliveryChallans"
  | "purchases"
  | "items"
  | "customers"
  | "vendors"
  | "banking"
  | "ageing"
  | "sites"
  | "expenses"
  | "myAttendance"
  | "allAttendance"
  | "track";

export type PermissionAction = "view" | "add" | "edit" | "delete";

export const PAGE_KEYS: PageKey[] = [
  "dashboard",
  "invoices",
  "deliveryChallans",
  "purchases",
  "items",
  "customers",
  "vendors",
  "banking",
  "ageing",
  "sites",
  "expenses",
  "myAttendance",
  "allAttendance",
  "track",
];

export const PAGE_LABELS: Record<PageKey, string> = {
  dashboard: "Dashboard",
  invoices: "Invoices",
  deliveryChallans: "Delivery Challans",
  purchases: "Purchases",
  items: "Items",
  customers: "Customers",
  vendors: "Vendors",
  banking: "Banking",
  ageing: "Ageing Report",
  sites: "Sites",
  expenses: "Expense Tracker",
  myAttendance: "My Attendance",
  allAttendance: "All Attendance",
  track: "Track (Live Location)",
};

export interface PagePermissionSet {
  canView: boolean;
  canAdd: boolean;
  canEdit: boolean;
  canDelete: boolean;
}

export const NO_ACCESS: PagePermissionSet = { canView: false, canAdd: false, canEdit: false, canDelete: false };
export const FULL_ACCESS: PagePermissionSet = { canView: true, canAdd: true, canEdit: true, canDelete: true };
