export interface PayslipTemplateData {
  company: {
    name: string;
    address: string;
    logoUrl: string;
  };
  employee: {
    name: string;
    email: string;
  };
  monthLabel: string; // e.g. "August 2026"
  workingDays: number;
  presentDays: number;
  lopDays: number;
  earnings: { basic: number; hra: number; conveyance: number; medicalAllowance: number; specialAllowance: number; gross: number };
  deductions: { tds: number; professionalTax: number; lopDeduction: number; otherDeductions: number; total: number };
  reimbursements: number;
  netPayable: number;
  generatedOn: string;
}

function money(n: number): string {
  return n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default function PayslipTemplate({ data }: { data: PayslipTemplateData }) {
  const { company, employee, earnings, deductions } = data;

  return (
    <div className="payslip-page">
      <div className="payslip-header">
        <img src={company.logoUrl} alt={`${company.name} logo`} />
        <div>
          <div className="payslip-company-name">{company.name}</div>
          <div className="payslip-company-address">{company.address}</div>
        </div>
      </div>

      <div className="payslip-title">Payslip for {data.monthLabel}</div>

      <div className="payslip-meta">
        <div className="payslip-meta-row">
          <span className="payslip-meta-label">Employee Name</span>
          <span className="payslip-meta-value">{employee.name}</span>
        </div>
        <div className="payslip-meta-row">
          <span className="payslip-meta-label">Email</span>
          <span className="payslip-meta-value">{employee.email}</span>
        </div>
        <div className="payslip-meta-row">
          <span className="payslip-meta-label">Working Days</span>
          <span className="payslip-meta-value">{data.workingDays}</span>
        </div>
        <div className="payslip-meta-row">
          <span className="payslip-meta-label">Present Days</span>
          <span className="payslip-meta-value">{data.presentDays}</span>
        </div>
        <div className="payslip-meta-row">
          <span className="payslip-meta-label">LOP Days</span>
          <span className="payslip-meta-value">{data.lopDays}</span>
        </div>
        <div className="payslip-meta-row">
          <span className="payslip-meta-label">Generated On</span>
          <span className="payslip-meta-value">{data.generatedOn}</span>
        </div>
      </div>

      <div className="payslip-tables">
        <table className="payslip-table">
          <thead>
            <tr>
              <th colSpan={2}>Earnings</th>
            </tr>
          </thead>
          <tbody>
            <tr><td>Basic</td><td>{money(earnings.basic)}</td></tr>
            <tr><td>HRA</td><td>{money(earnings.hra)}</td></tr>
            <tr><td>Conveyance</td><td>{money(earnings.conveyance)}</td></tr>
            <tr><td>Medical Allowance</td><td>{money(earnings.medicalAllowance)}</td></tr>
            <tr><td>Special Allowance</td><td>{money(earnings.specialAllowance)}</td></tr>
          </tbody>
          <tfoot>
            <tr><td>Gross Earnings</td><td>{money(earnings.gross)}</td></tr>
          </tfoot>
        </table>

        <table className="payslip-table">
          <thead>
            <tr>
              <th colSpan={2}>Deductions</th>
            </tr>
          </thead>
          <tbody>
            <tr><td>TDS</td><td>{money(deductions.tds)}</td></tr>
            <tr><td>Professional Tax</td><td>{money(deductions.professionalTax)}</td></tr>
            <tr><td>Loss of Pay ({data.lopDays} day{data.lopDays === 1 ? "" : "s"})</td><td>{money(deductions.lopDeduction)}</td></tr>
            <tr><td>Other Deductions</td><td>{money(deductions.otherDeductions)}</td></tr>
          </tbody>
          <tfoot>
            <tr><td>Total Deductions</td><td>{money(deductions.total)}</td></tr>
          </tfoot>
        </table>
      </div>

      {data.reimbursements > 0 && (
        <div className="payslip-meta" style={{ gridTemplateColumns: "1fr" }}>
          <div className="payslip-meta-row">
            <span className="payslip-meta-label">Reimbursements</span>
            <span className="payslip-meta-value">Rs. {money(data.reimbursements)}</span>
          </div>
        </div>
      )}

      <div className="payslip-net-payable">
        <span>Net Payable</span>
        <span>Rs. {money(data.netPayable)}</span>
      </div>

      <div className="payslip-formula">
        Net Payable = Gross Earnings ({money(earnings.gross)}) &minus; Total Deductions ({money(deductions.total)}) + Reimbursements ({money(data.reimbursements)}) = Rs. {money(data.netPayable)}
      </div>

      <div className="payslip-footer">This is a computer-generated payslip and does not require a signature.</div>
    </div>
  );
}
