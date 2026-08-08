import { PurchaseBillViewData } from "@/lib/purchase-template-data";

function money(n: number): string {
  return n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// Keeps the item table (and so the printed page) at a consistent height whether the
// bill carries a handful of lines or many -- short bills still fill out the sheet
// instead of leaving a lot of dead space above the totals.
const MIN_ITEM_ROWS = 7;

export default function PurchaseBillTemplate({ bill }: { bill: PurchaseBillViewData }) {
  const hasIgst = bill.totalIgst > 0;
  const summaryColSpan = hasIgst ? 11 : 9;
  const blankRows = Math.max(0, MIN_ITEM_ROWS - bill.items.length);

  return (
    <div className="invoice-page">
      <div className="title-row">PURCHASE BILL (INTERNAL RECORD)</div>

      <table className="header-table">
        <tbody>
          <tr>
            <td className="seller-cell">
              <div className="seller-block">
                <img src={bill.buyer.logoUrl} alt={`${bill.buyer.name} logo`} className="logo-img" />
                <div className="seller-info">
                  <div className="seller-name">{bill.buyer.name}</div>
                  <div>{bill.buyer.address}</div>
                  <div>GSTIN : <b>{bill.buyer.gstin}</b> <span className="state-badge">State Code : {bill.buyer.stateCode}</span></div>
                </div>
              </div>
            </td>
            <td className="meta-cell">
              <table className="meta-table">
                <tbody>
                  <tr>
                    <td><div className="meta-label">Bill Number</div><div className="meta-value">{bill.number}</div></td>
                    <td><div className="meta-label">Vendor Bill Ref.</div><div className="meta-value">{bill.vendorBillNumber ?? "—"}</div></td>
                  </tr>
                  <tr>
                    <td><div className="meta-label">Date</div><div className="meta-value">{bill.date}</div></td>
                    <td><div className="meta-label">Due Date</div><div className="meta-value">{bill.dueDate ?? "—"}</div></td>
                  </tr>
                  <tr>
                    <td><div className="meta-label">Status</div><div className="meta-value">{bill.status.replace("_", " ")}</div></td>
                    <td><div className="meta-label">Site</div><div className="meta-value">{bill.site ?? "—"}</div></td>
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
              <div className="party-header">Vendor</div>
              <div><b>Name: {bill.vendor.name}</b></div>
              <div>Address: - {bill.vendor.address}</div>
              <div>GSTIN: {bill.vendor.gstin} <span className="state-badge">State Code : {bill.vendor.stateCode}</span></div>
              <div>State: {bill.vendor.state}</div>
            </td>
          </tr>
        </tbody>
      </table>

      <table className="items-table">
        <thead>
          <tr>
            <th rowSpan={2}>Sr. No.</th>
            <th rowSpan={2}>Description</th>
            <th rowSpan={2}>HSN/SAC</th>
            <th rowSpan={2}>QTY</th>
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
          {bill.items.map((item) => (
            <tr key={item.srNo}>
              <td className="center">{item.srNo}</td>
              <td className="left">{item.description}</td>
              <td className="center">{item.hsnCode}</td>
              <td className="center">{item.qty}</td>
              <td className="right">{money(item.rate)}</td>
              <td className="right highlight">{money(item.taxableValue)}</td>
              <td className="center">{item.cgstRate.toFixed(2)}%</td>
              <td className="right">{item.cgstAmount.toFixed(2)}</td>
              <td className="center">{item.sgstRate.toFixed(2)}%</td>
              <td className="right">{item.sgstAmount.toFixed(2)}</td>
              {hasIgst && (
                <>
                  <td className="center">{item.igstRate.toFixed(2)}%</td>
                  <td className="right">{item.igstAmount.toFixed(2)}</td>
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
            <td className="right bold">Rs. {money(bill.subtotal)}</td>
          </tr>
          <tr>
            <td colSpan={summaryColSpan} className="right bold">Discount</td>
            <td className="right bold">Rs. {money(bill.discount)}</td>
          </tr>
          <tr>
            <td colSpan={summaryColSpan} className="right bold">Add:CGST</td>
            <td className="right bold">Rs. {money(bill.totalCgst)}</td>
          </tr>
          <tr>
            <td colSpan={summaryColSpan} className="right bold">Add : SGST</td>
            <td className="right bold">Rs. {money(bill.totalSgst)}</td>
          </tr>
          {hasIgst && (
            <tr>
              <td colSpan={summaryColSpan} className="right bold">Add : IGST</td>
              <td className="right bold">Rs. {money(bill.totalIgst)}</td>
            </tr>
          )}
          <tr>
            <td colSpan={summaryColSpan} className="right bold">TOTAL</td>
            <td className="right bold">Rs. {money(bill.grandTotal)}</td>
          </tr>
        </tbody>
      </table>

      <div style={{ marginTop: 16, fontSize: 10, color: "#555" }}>
        This is an internal purchase record generated by {bill.buyer.name} to document goods/services received from
        the vendor above and the resulting accounts payable -- not a document issued by the vendor.
      </div>
    </div>
  );
}
