import { InvoiceData } from "@/lib/invoice-types";

function money(n: number): string {
  return n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// Keeps the item table (and so the printed page) at a consistent height whether the
// invoice carries a handful of lines or many -- short invoices still fill out the sheet
// instead of leaving a lot of dead space above the totals. Tuned for landscape A4 (see
// generate-real-invoice-pdf.ts): landscape trades page height for width, so this needs
// to stay small enough that the Bank Details/Terms blocks below the item table still
// fit on the same page instead of spilling onto an otherwise-empty page 2.
const MIN_ITEM_ROWS = 2;

export default function InvoiceTemplate({ invoice }: { invoice: InvoiceData }) {
  const { seller, billedTo, shippedTo, items, bank } = invoice;
  const hasIgst = (invoice.totalIgst ?? 0) > 0;
  const summaryColSpan = hasIgst ? 13 : 11;
  const blankRows = Math.max(0, MIN_ITEM_ROWS - items.length);
  const documentTitle =
    invoice.documentType === "PROFORMA" ? "PROFORMA INVOICE" : invoice.isServiceInvoice ? "SERVICE TAX INVOICE" : "TAX INVOICE";

  return (
    <div className="invoice-page">
      <img src={seller.logoUrl} alt="" aria-hidden="true" className="invoice-logo-watermark" />
      {invoice.watermark && <div className="invoice-watermark">{invoice.watermark}</div>}
      <div className="title-row">{documentTitle}</div>
      <div className="original-badge">Original For Recipient</div>

      <table className="header-table">
        <tbody>
          <tr>
            <td className="seller-cell">
              <div className="seller-block">
                <img src={seller.logoUrl} alt={`${seller.name} logo`} className="logo-img" />
                <div className="seller-info">
                  <div className="seller-name">{seller.name}</div>
                  {seller.addressLines.map((line, i) => (
                    <div key={i}>{line}</div>
                  ))}
                  <div>&#9742; {seller.phone} &#9993; {seller.email}</div>
                  <div>GSTIN : <b>{seller.gstin}</b> <span className="state-badge">State Code : {seller.stateCode}</span></div>
                  <div>PAN : <b>{seller.pan}</b></div>
                  {seller.cinNo && <div>CIN : <b>{seller.cinNo}</b></div>}
                  {seller.website && <div>Website : {seller.website}</div>}
                  {seller.altEmail && <div>Email : {seller.altEmail}</div>}
                  {seller.altMobile && <div>MOBILE NO : {seller.altMobile}</div>}
                  {seller.udyam && (
                    <>
                      <div>{seller.udyam} :</div>
                      <div>{seller.udyam} :</div>
                      <div>: {seller.altMobile}</div>
                    </>
                  )}
                </div>
              </div>
            </td>
            <td className="meta-cell">
              <table className="meta-table">
                <tbody>
                  <tr>
                    <td><div className="meta-label">Invoice Number</div><div className="meta-value">{invoice.invoiceNumber}</div></td>
                    <td><div className="meta-label">Invoice Date</div><div className="meta-value">{invoice.invoiceDate}</div></td>
                    <td><div className="meta-label">Place of Supply</div><div className="meta-value">{invoice.placeOfSupply}</div></td>
                  </tr>
                  <tr>
                    <td><div className="meta-label">Date Of Supply</div><div className="meta-value">{invoice.dateOfSupply}</div></td>
                    <td><div className="meta-label">Reverse Charge</div><div className="meta-value">{invoice.reverseCharge}</div></td>
                    <td><div className="meta-label">PO Number</div><div className="meta-value">{invoice.poNumber}</div></td>
                  </tr>
                  <tr>
                    <td><div className="meta-label">PO Date</div><div className="meta-value">{invoice.poDate}</div></td>
                    <td><div className="meta-label">Vehicle Number</div><div className="meta-value">{invoice.vehicleNumber}</div></td>
                    <td><div className="meta-label">Transportation Mode</div><div className="meta-value">{invoice.transportationMode}</div></td>
                  </tr>
                  <tr>
                    <td><div className="meta-label">Place Of Supply</div><div className="meta-value">{invoice.placeOfSupplySite}</div></td>
                    <td colSpan={2}><div className="meta-label">DELIVERD THREW</div><div className="meta-value">{invoice.deliveredThrough}</div></td>
                  </tr>
                  <tr>
                    <td><div className="meta-label">Site</div><div className="meta-value">{invoice.site}</div></td>
                    <td colSpan={2}><div className="meta-label">Payment Terms</div><div className="meta-value">{invoice.paymentTerms}</div></td>
                  </tr>
                </tbody>
              </table>
            </td>
          </tr>
        </tbody>
      </table>

      <table className="parties-table">
        <tbody>
          <tr>
            <td className="party-cell">
              <div className="party-header">Details of Receiver | Billed to</div>
              <div><b>Name: {billedTo.name}</b></div>
              <div>Address: - {billedTo.address}</div>
              <div>Mobile: {billedTo.mobile}</div>
              <div>Email: {billedTo.email}</div>
              <div>GSTIN: {billedTo.gstin} <span className="state-badge">State Code : {billedTo.stateCode}</span></div>
              <div>State: {billedTo.state}</div>
            </td>
            <td className="party-cell">
              <div className="party-header">Details of Consignee | Shipped to</div>
              <div><b>Name: {shippedTo.name}</b></div>
              <div>Address: - {shippedTo.address}</div>
              <div>GSTIN: {shippedTo.gstin} <span className="state-badge">State Code : {shippedTo.stateCode}</span></div>
              <div>State: {shippedTo.state}</div>
            </td>
          </tr>
        </tbody>
      </table>

      <table className="items-table">
        <thead>
          <tr>
            <th rowSpan={2}>Sr. No.</th>
            <th rowSpan={2}>Name of Product</th>
            <th rowSpan={2}>HSN/SAC</th>
            <th rowSpan={2}>QTY</th>
            <th rowSpan={2}>Unit</th>
            <th rowSpan={2}>Rate</th>
            <th rowSpan={2}>Taxable Value</th>
            <th colSpan={2}>CGST</th>
            <th colSpan={2}>SGST</th>
            {hasIgst && <th colSpan={2}>IGST</th>}
            <th rowSpan={2}>Total</th>
          </tr>
          <tr>
            <th>Rate</th>
            <th>Amount</th>
            <th>Rate</th>
            <th>Amount</th>
            {hasIgst && (
              <>
                <th>Rate</th>
                <th>Amount</th>
              </>
            )}
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr key={item.srNo}>
              <td className="center">{item.srNo}</td>
              <td className="left">
                <div className="item-name">{item.name}</div>
                {item.description && <div className="item-desc">{item.description}</div>}
              </td>
              <td className="center">{item.hsnSac}</td>
              <td className="center">{item.qty}</td>
              <td className="center">{item.unit}</td>
              <td className="right">{money(item.rate)}</td>
              <td className="right highlight">{money(item.taxableValue)}</td>
              <td className="center">{item.cgstRate.toFixed(2)}%</td>
              <td className="right">{item.cgstAmount.toFixed(2)}</td>
              <td className="center">{item.sgstRate.toFixed(2)}%</td>
              <td className="right">{item.sgstAmount.toFixed(2)}</td>
              {hasIgst && (
                <>
                  <td className="center">{(item.igstRate ?? 0).toFixed(2)}%</td>
                  <td className="right">{(item.igstAmount ?? 0).toFixed(2)}</td>
                </>
              )}
              <td className="right bold">Rs. {money(item.total)}</td>
            </tr>
          ))}
          {Array.from({ length: blankRows }, (_, i) => (
            <tr key={`blank-${i}`}>
              <td>&nbsp;</td>
              <td></td>
              <td></td>
              <td></td>
              <td></td>
              <td></td>
              <td></td>
              <td></td>
              <td></td>
              <td></td>
              <td></td>
              {hasIgst && (
                <>
                  <td></td>
                  <td></td>
                </>
              )}
              <td></td>
            </tr>
          ))}
          <tr>
            <td colSpan={summaryColSpan} className="right bold">Taxable Amount</td>
            <td className="right bold">Rs. {money(invoice.taxableAmount)}</td>
          </tr>
          <tr>
            <td colSpan={summaryColSpan} className="right bold">Add:CGST</td>
            <td className="right bold">Rs. {money(invoice.totalCgst)}</td>
          </tr>
          <tr>
            <td colSpan={summaryColSpan} className="right bold">Add : SGST</td>
            <td className="right bold">Rs. {money(invoice.totalSgst)}</td>
          </tr>
          {hasIgst && (
            <tr>
              <td colSpan={summaryColSpan} className="right bold">Add : IGST</td>
              <td className="right bold">Rs. {money(invoice.totalIgst ?? 0)}</td>
            </tr>
          )}
          <tr>
            <td colSpan={summaryColSpan} className="right bold">TOTAL</td>
            <td className="right bold">Rs. {invoice.grandTotal.toFixed(1)}</td>
          </tr>
        </tbody>
      </table>

      <table className="words-table">
        <tbody>
          <tr>
            <td className="words-cell">
              <b>Total Amount in words :-</b> {invoice.amountInWords}
            </td>
            <td className="words-total-label">Total</td>
            <td className="words-total-value">Rs. {money(invoice.grandTotal)}</td>
          </tr>
        </tbody>
      </table>

      <table className="bank-sign-table">
        <tbody>
          <tr>
            <td className="bank-cell">
              <div className="bank-header">&#127974; Bank and Payment Details</div>
              <table className="bank-details-table">
                <tbody>
                  <tr><td>Account Name</td><td><b>{bank.accountName}</b></td></tr>
                  <tr><td>Account No.</td><td><b>{bank.accountNo}</b></td></tr>
                  <tr><td>IFSC Code</td><td><b>{bank.ifsc}</b></td></tr>
                  <tr><td>Bank Name</td><td><b>{bank.bankName}</b></td></tr>
                  <tr><td>Branch Name</td><td><b>{bank.branchName}</b></td></tr>
                </tbody>
              </table>
            </td>
            <td className="sign-cell">
              <div>Certified that the particular given above are true and correct for,</div>
              <div className="bold">For, {seller.name}</div>
              <div className="sign-space" />
              <div className="right">Authorised Signatory</div>
            </td>
          </tr>
        </tbody>
      </table>

      <table className="terms-table">
        <tbody>
          <tr>
            <td className="terms-cell">
              <div className="bold">Terms And Conditions</div>
              {invoice.terms.map((t, i) => (
                <div key={i}>{t}</div>
              ))}
            </td>
            <td className="terms-sign-cell">
              <div>Received the above goods in good condition.</div>
              <div className="sign-space" />
              <div className="right">Receiver&apos;s Signature</div>
            </td>
          </tr>
        </tbody>
      </table>

      <div className="thank-you-bottom">This is a computer-generated invoice and does not require a signature.</div>
    </div>
  );
}
