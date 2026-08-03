export interface InvoiceLineItem {
  srNo: number;
  name: string;
  description?: string;
  hsnSac: string;
  qty: number;
  unit: string;
  rate: number;
  taxableValue: number;
  cgstRate: number;
  cgstAmount: number;
  sgstRate: number;
  sgstAmount: number;
  igstRate?: number;
  igstAmount?: number;
  total: number;
}

export interface PartyDetails {
  name: string;
  address: string;
  mobile?: string;
  email?: string;
  gstin: string;
  stateCode: string;
  state: string;
}

export interface SellerDetails {
  name: string;
  addressLines: string[];
  phone: string;
  email: string;
  gstin: string;
  stateCode: string;
  pan: string;
  altEmail?: string;
  altMobile?: string;
  udyam?: string;
  logoUrl: string;
}

export interface BankDetails {
  accountName: string;
  accountNo: string;
  ifsc: string;
  bankName: string;
  branchName: string;
}

export interface InvoiceData {
  /** Determines the printed document title: TAX INVOICE for a real sale, PROFORMA
   * INVOICE for a quote that hasn't been converted yet. Defaults to SALE. */
  documentType?: "SALE" | "PROFORMA";
  invoiceNumber: string;
  invoiceDate: string;
  placeOfSupply: string;
  dateOfSupply: string;
  reverseCharge: "YES" | "NO";
  poNumber?: string;
  poDate?: string;
  vehicleNumber?: string;
  transportationMode?: string;
  placeOfSupplySite?: string;
  deliveredThrough?: string;
  /** Diagonal overlay text shown across the printed document, e.g. "CANCELLED" for an
   * archived or cancelled invoice. Unset for a normal, live invoice. */
  watermark?: string;

  seller: SellerDetails;
  billedTo: PartyDetails;
  shippedTo: PartyDetails;

  items: InvoiceLineItem[];

  taxableAmount: number;
  totalCgst: number;
  totalSgst: number;
  totalIgst?: number;
  grandTotal: number;
  amountInWords: string;

  bank: BankDetails;
  terms: string[];
}
