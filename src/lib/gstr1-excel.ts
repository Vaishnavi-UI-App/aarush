import ExcelJS from "exceljs";
import { round2 } from "@/lib/gst-invoice";
import { normalizeStateCode, stateName } from "@/lib/state-codes";
import {
  B2bRow,
  B2clRow,
  B2csRow,
  DocsSummary,
  Gstr1Company,
  Gstr1Customer,
  Gstr1Invoice,
  HsnRow,
  formatGstDate,
  rateRowsFor,
  totalTaxOf,
} from "@/lib/gstr1";

export interface Gstr1Workbook {
  company: Gstr1Company;
  customer: Gstr1Customer;
  fromDate: Date;
  toDate: Date;
  /** Invoices that belong in the tax sheets -- issued, not cancelled. */
  invoices: Gstr1Invoice[];
  supplyType: "b2b" | "b2cl" | "b2cs";
  b2b: B2bRow[];
  b2cl: B2clRow[];
  b2cs: B2csRow[];
  hsn: HsnRow[];
  docs: DocsSummary;
}

const MONEY = "0.00";
const QTY = "0.000";
const HEADER_FILL: ExcelJS.Fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFD9E1F2" } };
const TITLE_FILL: ExcelJS.Fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFCE4D6" } };

function styleHeader(row: ExcelJS.Row, fill: ExcelJS.Fill = HEADER_FILL) {
  row.font = { bold: true, size: 10 };
  row.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
  row.eachCell({ includeEmpty: true }, (cell) => {
    cell.fill = fill;
    cell.border = {
      top: { style: "thin" },
      left: { style: "thin" },
      bottom: { style: "thin" },
      right: { style: "thin" },
    };
  });
}

function setWidths(sheet: ExcelJS.Worksheet, widths: number[]) {
  widths.forEach((w, i) => {
    sheet.getColumn(i + 1).width = w;
  });
}

/** Applies a number format to a span of columns on every data row written so far. */
function formatColumns(sheet: ExcelJS.Worksheet, firstDataRow: number, cols: number[], fmt: string) {
  for (let r = firstDataRow; r <= sheet.rowCount; r++) {
    for (const c of cols) sheet.getRow(r).getCell(c).numFmt = fmt;
  }
}

function borderDataRows(sheet: ExcelJS.Worksheet, firstDataRow: number, lastCol: number) {
  for (let r = firstDataRow; r <= sheet.rowCount; r++) {
    for (let c = 1; c <= lastCol; c++) {
      sheet.getRow(r).getCell(c).border = {
        top: { style: "thin" },
        left: { style: "thin" },
        bottom: { style: "thin" },
        right: { style: "thin" },
      };
    }
  }
}

/** The cover sheet: a plain sales register for the period, laid out the way the
 * reference printout is -- company details up top, then one row per invoice and rate. */
function addCoverSheet(wb: ExcelJS.Workbook, data: Gstr1Workbook) {
  const sheet = wb.addWorksheet("gstr1");
  setWidths(sheet, [18, 28, 12, 20, 18, 14, 16, 11, 16, 16, 16, 16]);

  sheet.getCell("A1").value = data.company.name;
  sheet.getCell("A1").font = { bold: true, size: 14 };
  sheet.getCell("A2").value = `Phone No: ${data.company.phone ?? "-"}`;
  sheet.getCell("A3").value = `GSTIN: ${data.company.gstin}`;

  sheet.getCell("A5").value = "GSTR-1";
  sheet.getCell("A5").font = { bold: true, size: 12 };
  sheet.getCell("A6").value = `Dated: ${formatGstDate(data.fromDate)}-${formatGstDate(data.toDate)}`;

  sheet.getCell("A8").value = `Customer: ${data.customer.name}`;
  sheet.getCell("A8").font = { bold: true };
  sheet.getCell("A9").value = `GSTIN: ${data.customer.gstin || "Unregistered"}`;
  sheet.getCell("A10").value = `State: ${stateName(data.customer.stateCode)}`;

  sheet.getCell("A13").value = "Sales";
  sheet.getCell("A13").font = { bold: true, size: 11 };

  // Two tiers: grouped captions on row 14, the columns they cover on row 15. A single
  // row can't express "Invoice Details" spanning three columns.
  sheet.getCell("A14").value = "GSTIN";
  sheet.getCell("B14").value = "Customer Name";
  sheet.getCell("C14").value = "Place of supply";
  sheet.getCell("E14").value = "Invoice Details";
  sheet.getCell("H14").value = "Total Tax%";
  sheet.getCell("I14").value = "Taxable Value";
  sheet.getCell("J14").value = "Amount of Tax";

  sheet.mergeCells("A14:A15");
  sheet.mergeCells("B14:B15");
  sheet.mergeCells("C14:D14");
  sheet.mergeCells("E14:G14");
  sheet.mergeCells("H14:H15");
  sheet.mergeCells("I14:I15");
  sheet.mergeCells("J14:L14");

  sheet.getCell("C15").value = "State Code";
  sheet.getCell("D15").value = "State Name";
  sheet.getCell("E15").value = "Invoice Number";
  sheet.getCell("F15").value = "Invoice Date";
  sheet.getCell("G15").value = "Invoice value";
  // Integrated Tax is carried alongside Central/State: without it an inter-state
  // invoice would show a taxable value and no tax at all.
  sheet.getCell("J15").value = "Integrated Tax Amount";
  sheet.getCell("K15").value = "Central Tax Amount";
  sheet.getCell("L15").value = "State/UT Tax Amount";

  styleHeader(sheet.getRow(14));
  styleHeader(sheet.getRow(15));

  let taxable = 0;
  let igst = 0;
  let cgst = 0;
  let sgst = 0;
  for (const inv of data.invoices) {
    for (const r of rateRowsFor(inv)) {
      sheet.addRow([
        data.customer.gstin || "",
        data.customer.name,
        normalizeStateCode(inv.placeOfSupplyStateCode),
        stateName(inv.placeOfSupplyStateCode),
        inv.number,
        formatGstDate(inv.date),
        round2(inv.total),
        r.rate,
        r.taxableValue,
        r.igst,
        r.cgst,
        r.sgst,
      ]);
      taxable += r.taxableValue;
      igst += r.igst;
      cgst += r.cgst;
      sgst += r.sgst;
    }
  }

  const firstDataRow = 16;
  if (sheet.rowCount >= firstDataRow) {
    const totals = sheet.addRow(["", "", "", "", "", "Total", "", "", round2(taxable), round2(igst), round2(cgst), round2(sgst)]);
    totals.font = { bold: true };
    formatColumns(sheet, firstDataRow, [7, 9, 10, 11, 12], MONEY);
    borderDataRows(sheet, firstDataRow, 12);
  } else {
    sheet.addRow(["No invoices for this customer in the selected period."]);
  }
}

function addB2bSheet(wb: ExcelJS.Workbook, data: Gstr1Workbook) {
  const sheet = wb.addWorksheet("b2b");
  setWidths(sheet, [20, 26, 16, 14, 16, 22, 14, 10, 16, 14]);

  const invoiceNumbers = new Set(data.b2b.map((r) => r.invoiceNumber));
  // Counted per distinct invoice, not per row: an invoice billed at two rates appears
  // twice here, and its value must not be double-counted. Only B2B invoices belong in
  // this total -- summing every invoice would put a B2CS customer's turnover on a sheet
  // that has no rows at all.
  const invoiceValue = round2(
    [...invoiceNumbers].reduce((s, n) => s + (data.invoices.find((i) => i.number === n)?.total ?? 0), 0)
  );
  const totalTaxable = round2(data.b2b.reduce((s, r) => s + r.taxableValue, 0));
  const totalCess = round2(data.b2b.reduce((s, r) => s + r.cess, 0));

  sheet.getCell("A1").value = "Summary For B2B";
  sheet.getCell("A1").font = { bold: true, size: 12 };
  sheet.getCell("A1").fill = TITLE_FILL;

  sheet.addRow(["No. of Recipients", "No. of Invoices", "Total Invoice Value", "Total Taxable", "Total Cess"]);
  styleHeader(sheet.getRow(2));
  sheet.addRow([data.b2b.length ? 1 : 0, invoiceNumbers.size, invoiceValue, totalTaxable, totalCess]);
  sheet.getRow(3).font = { bold: true };

  sheet.addRow([
    "GSTIN/UIN of Recipient",
    "Receiver Name",
    "Invoice Number",
    "Invoice date",
    "Invoice Value",
    "Place Of Supply",
    "Reverse Charge",
    "Rate",
    "Taxable Value",
    "Cess Amount",
  ]);
  styleHeader(sheet.getRow(4));

  for (const r of data.b2b) {
    sheet.addRow([
      r.gstin,
      r.receiverName,
      r.invoiceNumber,
      formatGstDate(r.invoiceDate),
      r.invoiceValue,
      r.placeOfSupply,
      r.reverseCharge,
      r.rate,
      r.taxableValue,
      r.cess,
    ]);
  }

  formatColumns(sheet, 5, [5, 9, 10], MONEY);
  borderDataRows(sheet, 5, 10);
}

function addB2clSheet(wb: ExcelJS.Workbook, data: Gstr1Workbook) {
  const sheet = wb.addWorksheet("b2cl");
  setWidths(sheet, [16, 14, 16, 22, 10, 16, 14, 20]);

  const invoiceNumbers = new Set(data.b2cl.map((r) => r.invoiceNumber));
  const invoiceValue = round2([...invoiceNumbers].reduce((s, n) => s + (data.invoices.find((i) => i.number === n)?.total ?? 0), 0));

  sheet.getCell("A1").value = "Summary For B2CL";
  sheet.getCell("A1").font = { bold: true, size: 12 };
  sheet.getCell("A1").fill = TITLE_FILL;

  sheet.addRow(["No. of Invoices", "Total Invoice Value", "Total Taxable Value", "Total Cess"]);
  styleHeader(sheet.getRow(2));
  sheet.addRow([
    invoiceNumbers.size,
    invoiceValue,
    round2(data.b2cl.reduce((s, r) => s + r.taxableValue, 0)),
    round2(data.b2cl.reduce((s, r) => s + r.cess, 0)),
  ]);
  sheet.getRow(3).font = { bold: true };

  sheet.addRow(["Invoice Number", "Invoice date", "Invoice Value", "Place Of Supply", "Rate", "Taxable Value", "Cess Amount", "E-Commerce GSTIN"]);
  styleHeader(sheet.getRow(4));

  for (const r of data.b2cl) {
    sheet.addRow([r.invoiceNumber, formatGstDate(r.invoiceDate), r.invoiceValue, r.placeOfSupply, r.rate, r.taxableValue, r.cess, ""]);
  }

  formatColumns(sheet, 5, [3, 6, 7], MONEY);
  borderDataRows(sheet, 5, 8);
}

function addB2csSheet(wb: ExcelJS.Workbook, data: Gstr1Workbook) {
  const sheet = wb.addWorksheet("b2cs");
  setWidths(sheet, [10, 22, 10, 16, 14, 20]);

  sheet.getCell("A1").value = "Summary For B2CS";
  sheet.getCell("A1").font = { bold: true, size: 12 };
  sheet.getCell("A1").fill = TITLE_FILL;

  sheet.addRow(["No. of Records", "Total Taxable Value", "Total Cess"]);
  styleHeader(sheet.getRow(2));
  sheet.addRow([
    data.b2cs.length,
    round2(data.b2cs.reduce((s, r) => s + r.taxableValue, 0)),
    round2(data.b2cs.reduce((s, r) => s + r.cess, 0)),
  ]);
  sheet.getRow(3).font = { bold: true };

  sheet.addRow(["Type", "Place Of Supply", "Rate", "Taxable Value", "Cess Amount", "E-Commerce GSTIN"]);
  styleHeader(sheet.getRow(4));

  for (const r of data.b2cs) {
    sheet.addRow([r.type, r.placeOfSupply, r.rate, r.taxableValue, r.cess, ""]);
  }

  formatColumns(sheet, 5, [4, 5], MONEY);
  borderDataRows(sheet, 5, 6);
}

function addHsnSheet(wb: ExcelJS.Workbook, data: Gstr1Workbook) {
  // The portal keeps outward HSN summaries separate for registered and unregistered
  // recipients, so the sheet is named after which one this customer is.
  const name = data.supplyType === "b2b" ? "hsn(b2b)" : "hsn(b2c)";
  const sheet = wb.addWorksheet(name);
  setWidths(sheet, [14, 30, 10, 14, 16, 10, 16, 18, 16, 18, 14]);

  const sum = (pick: (r: HsnRow) => number) => round2(data.hsn.reduce((s, r) => s + pick(r), 0));

  sheet.getCell("A1").value = `Summary For HSN(${data.hsn.length})`;
  sheet.getCell("A1").font = { bold: true, size: 12 };
  sheet.getCell("A1").fill = TITLE_FILL;

  sheet.addRow([
    "No. of HSN",
    "Total Value",
    "Total Taxable Value",
    "Total Integrated Tax",
    "Total Central Tax",
    "Total State/UT Tax",
    "Total Cess",
  ]);
  styleHeader(sheet.getRow(2));
  sheet.addRow([
    data.hsn.length,
    sum((r) => r.totalValue),
    sum((r) => r.taxableValue),
    sum((r) => r.igst),
    sum((r) => r.cgst),
    sum((r) => r.sgst),
    sum((r) => r.cess),
  ]);
  sheet.getRow(3).font = { bold: true };

  sheet.addRow([
    "HSN",
    "Description",
    "UQC",
    "Total Quantity",
    "Total Value",
    "Rate",
    "Taxable Value",
    "Integrated Tax Amount",
    "Central Tax Amount",
    "State/UT Tax Amount",
    "Cess Amount",
  ]);
  styleHeader(sheet.getRow(4));

  for (const r of data.hsn) {
    sheet.addRow([r.hsn, r.description, r.uqc, r.quantity, r.totalValue, r.rate, r.taxableValue, r.igst, r.cgst, r.sgst, r.cess]);
  }

  formatColumns(sheet, 5, [5, 7, 8, 9, 10, 11], MONEY);
  formatColumns(sheet, 5, [4], QTY);
  borderDataRows(sheet, 5, 11);
}

function addDocsSheet(wb: ExcelJS.Workbook, data: Gstr1Workbook) {
  const sheet = wb.addWorksheet("docs");
  setWidths(sheet, [34, 22, 22, 16, 14]);

  sheet.getCell("A1").value = `Summary of documents issued during the tax period (${data.docs.total})`;
  sheet.getCell("A1").font = { bold: true, size: 12 };
  sheet.getCell("A1").fill = TITLE_FILL;

  sheet.addRow(["Total Number", "Total Cancelled"]);
  styleHeader(sheet.getRow(2));
  sheet.addRow([data.docs.total, data.docs.cancelled]);
  sheet.getRow(3).font = { bold: true };

  sheet.addRow(["Nature of Document", "Sr. No. From", "Sr. No. To", "Total Number", "Cancelled"]);
  styleHeader(sheet.getRow(4));
  sheet.addRow(["Invoices for outward supply", data.docs.from, data.docs.to, data.docs.total, data.docs.cancelled]);
  borderDataRows(sheet, 5, 5);
}

export async function buildGstr1Workbook(data: Gstr1Workbook): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = data.company.name;
  wb.created = new Date();

  addCoverSheet(wb, data);

  // Every sheet is present whatever the customer turns out to be, so the file always
  // has the shape the offline tool expects; the ones that don't apply carry their
  // headers and no rows.
  addB2bSheet(wb, data);
  addB2clSheet(wb, data);
  addB2csSheet(wb, data);
  addHsnSheet(wb, data);
  addDocsSheet(wb, data);

  const out = await wb.xlsx.writeBuffer();
  return Buffer.from(out);
}

/** Total tax across the period, used for the response's summary line. */
export function periodTaxTotal(invoices: Gstr1Invoice[]): number {
  return round2(invoices.reduce((s, inv) => s + rateRowsFor(inv).reduce((t, r) => t + totalTaxOf(r), 0), 0));
}
