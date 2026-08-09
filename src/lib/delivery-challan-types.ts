export interface DeliveryChallanLineItem {
  srNo: number;
  particulars: string;
  qty: number;
  unit: string;
}

export interface DeliveryChallanData {
  challanNumber: string;
  date: string;
  poNumber?: string;
  poDate?: string;
  vehicleNumber?: string;
  toName?: string;
  toAddress?: string;
  /** The project/job Site (from the Sites feature) these goods are for, e.g. "Pune". */
  site?: string;

  seller: {
    name: string;
    tagline: string;
    gstin: string;
    logoUrl: string;
    email: string;
    phone: string;
    website: string;
    registeredOffice: string;
    branches: string;
  };

  lines: DeliveryChallanLineItem[];
  totalQty: number;
}
