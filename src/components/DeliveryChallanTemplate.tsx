import { DeliveryChallanData } from "@/lib/delivery-challan-types";

// Matches the row count on the printed paper challan -- the document keeps this
// standard size whether it carries one item or many, same as the invoice/proforma
// templates always print at a fixed A4 layout.
const MIN_ROWS = 10;

export default function DeliveryChallanTemplate({ challan }: { challan: DeliveryChallanData }) {
  const { seller, lines } = challan;
  const blankRows = Math.max(0, MIN_ROWS - lines.length);

  return (
    <div className="dc-page">
      <div className="dc-items-wrapper">
        <img src={seller.logoUrl} alt="" aria-hidden="true" className="dc-watermark" />
        <table className="dc-items-table">
          {/* The letterhead + To/challan-meta block lives in <thead> (rather than as
              standalone elements before this table) so it repeats at the top of every
              printed page for challans long enough to spill onto a second page -- only a
              table's own <thead> repeats across print page breaks. */}
          <thead>
            <tr className="dc-repeat-header-row">
              <td colSpan={4} className="dc-header-repeat-cell">
                <div className="dc-header">
                  <img src={seller.logoUrl} alt={`${seller.name} logo`} className="dc-logo" />
                  <div className="dc-header-text">
                    <div className="dc-company-name">{seller.name}</div>
                    <div className="dc-tagline">{seller.tagline}</div>
                  </div>
                </div>

                <div className="dc-gstin-row">
                  <div className="dc-gstin-box">GSTIN: {seller.gstin}</div>
                </div>

                <div className="dc-title">DELIVERY CHALLAN</div>

                <table className="dc-meta-table">
                  <tbody>
                    <tr>
                      <td className="dc-to-cell">
                        <div className="dc-to-label">To:</div>
                        <div className="dc-to-value">{challan.toName}</div>
                        <div className="dc-to-value">{challan.toAddress}</div>
                      </td>
                      <td className="dc-info-cell">
                        <div className="dc-info-row">
                          <span className="dc-info-label">Challan No:</span>
                          <span className="dc-info-value">{challan.challanNumber}</span>
                          <span className="dc-info-label dc-info-label-right">Date:</span>
                          <span className="dc-info-value">{challan.date}</span>
                        </div>
                        <div className="dc-info-row">
                          <span className="dc-info-label">P.O. No:</span>
                          <span className="dc-info-value">{challan.poNumber}</span>
                          <span className="dc-info-label dc-info-label-right">Date:</span>
                          <span className="dc-info-value">{challan.poDate}</span>
                        </div>
                        {challan.site && (
                          <div className="dc-info-row">
                            <span className="dc-info-label">Site:</span>
                            <span className="dc-info-value">{challan.site}</span>
                          </div>
                        )}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </td>
            </tr>
            <tr>
              <th className="dc-col-sr">Sr. No.</th>
              <th>Particulars</th>
              <th className="dc-col-qty">Qty.</th>
              <th className="dc-col-unit">Unit</th>
            </tr>
          </thead>
          <tbody>
            {lines.map((line) => (
              <tr key={line.srNo}>
                <td className="center">{line.srNo}</td>
                <td className="left">{line.particulars}</td>
                <td className="center">{line.qty}</td>
                <td className="center">{line.unit}</td>
              </tr>
            ))}
            {Array.from({ length: blankRows }, (_, i) => (
              <tr key={`blank-${i}`}>
                <td>&nbsp;</td>
                <td></td>
                <td></td>
                <td></td>
              </tr>
            ))}
            <tr>
              <td colSpan={2} className="right bold">
                Total:
              </td>
              <td className="center bold">{challan.totalQty}</td>
              <td></td>
            </tr>
          </tbody>
        </table>
      </div>

      <table className="dc-footer-table">
        <tbody>
          <tr>
            <td className="dc-footer-cell">Receiver&apos;s Signature &amp; Stamp</td>
            <td className="dc-footer-cell">Vehicle No.{challan.vehicleNumber ? `: ${challan.vehicleNumber}` : ""}</td>
            <td className="dc-footer-cell dc-footer-signatory">For {seller.name}</td>
          </tr>
        </tbody>
      </table>

      <div className="dc-bottom-footer">
        <div>
          <b>Registered Office:</b> {seller.registeredOffice}
        </div>
        <div>
          <b>Branches:</b> {seller.branches}
        </div>
        <div className="dc-contact-row">
          <span>{seller.email}</span>
          <span>{seller.phone}</span>
          <span>{seller.website}</span>
        </div>
      </div>
    </div>
  );
}
