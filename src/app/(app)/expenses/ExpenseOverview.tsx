import Link from "next/link";
import { WalletIcon, TrendDownIcon, PersonSpendIcon, ReimburseIcon, SiteBuildingIcon, HistoryIcon } from "@/components/icons";

interface RecentExpense {
  id: string;
  note: string | null;
  categoryName: string | null;
  fundType: "COMPANY" | "PERSONAL" | "SPLIT";
  amount: number;
}

interface SiteCard {
  id: string;
  name: string;
  expenseCount: number;
  companyBalance: number;
  totalReceived: number;
  companySpent: number;
  managerPending: number;
  recentExpenses: RecentExpense[];
}

function money(n: number) {
  return `₹${n.toFixed(0)}`;
}

export default function ExpenseOverview({
  companyBalance,
  companySpent,
  personalSpent,
  pendingReimbursement,
  siteCards,
}: {
  companyBalance: number;
  companySpent: number;
  personalSpent: number;
  pendingReimbursement: number;
  siteCards: SiteCard[];
}) {
  return (
    <div>
      <div className="exp-stat-grid">
        <div className="exp-stat-card">
          <div>
            <div className="exp-stat-label">Company Balance</div>
            <div className="exp-stat-value">{money(companyBalance)}</div>
          </div>
          <div className="exp-stat-icon exp-stat-icon-blue">
            <WalletIcon />
          </div>
        </div>
        <div className="exp-stat-card">
          <div>
            <div className="exp-stat-label">Company Spent</div>
            <div className="exp-stat-value">{money(companySpent)}</div>
          </div>
          <div className="exp-stat-icon exp-stat-icon-gray">
            <TrendDownIcon />
          </div>
        </div>
        <div className="exp-stat-card">
          <div>
            <div className="exp-stat-label">Manager Personal Spent</div>
            <div className="exp-stat-value exp-stat-value-red">{money(personalSpent)}</div>
          </div>
          <div className="exp-stat-icon exp-stat-icon-red">
            <PersonSpendIcon />
          </div>
        </div>
        <div className="exp-stat-card">
          <div>
            <div className="exp-stat-label">Pending Reimbursement</div>
            <div className="exp-stat-value exp-stat-value-amber">{money(pendingReimbursement)}</div>
          </div>
          <div className="exp-stat-icon exp-stat-icon-amber">
            <ReimburseIcon />
          </div>
        </div>
      </div>

      <div className="exp-banner">
        <div className="exp-banner-title">How it works</div>
        <div className="exp-banner-steps">
          <div className="exp-banner-step">
            <div className="exp-banner-step-num">1</div>
            <div className="exp-banner-step-text">Company adds funds → goes to site balance for manager to spend</div>
          </div>
          <div className="exp-banner-step">
            <div className="exp-banner-step-num">2</div>
            <div className="exp-banner-step-text">
              Manager adds expense → deducted from company balance first. When balance = 0, recorded as personal
            </div>
          </div>
          <div className="exp-banner-step">
            <div className="exp-banner-step-num">3</div>
            <div className="exp-banner-step-text">
              Next company fund → automatically reimburses manager&apos;s personal amount first, then tops up balance
            </div>
          </div>
        </div>
      </div>

      {siteCards.length === 0 ? (
        <div className="afs-card">
          <div className="afs-empty">No sites yet -- add one to start tracking expenses.</div>
        </div>
      ) : (
        <div className="exp-site-grid">
          {siteCards.map((site) => {
            const spentVsReceived = site.totalReceived > 0 ? Math.min(100, Math.round((site.companySpent / site.totalReceived) * 100)) : 0;
            return (
              <div key={site.id} className="exp-site-card">
                <div className="exp-site-head">
                  <div className="exp-site-head-left">
                    <div className="exp-site-icon">
                      <SiteBuildingIcon />
                    </div>
                    <div>
                      <div className="exp-site-name">{site.name}</div>
                      <div className="exp-site-count">
                        {site.expenseCount} expense{site.expenseCount === 1 ? "" : "s"}
                      </div>
                    </div>
                  </div>
                  <Link href={`/sites/${site.id}`} className="exp-history-link">
                    <HistoryIcon /> History
                  </Link>
                </div>

                <div className="exp-progress-row">
                  <span>Company spent vs received</span>
                  <span>{spentVsReceived}%</span>
                </div>
                <div className="exp-progress-track">
                  <div className="exp-progress-fill" style={{ width: `${spentVsReceived}%` }} />
                </div>

                <div className="exp-metric-grid">
                  <div className="exp-metric exp-metric-blue">
                    <div className="exp-metric-label">
                      <WalletIcon /> Company Balance
                    </div>
                    <div className="exp-metric-value">{money(site.companyBalance)}</div>
                  </div>
                  <div className="exp-metric exp-metric-plain">
                    <div className="exp-metric-label">Total Received</div>
                    <div className="exp-metric-value">{money(site.totalReceived)}</div>
                  </div>
                  <div className="exp-metric exp-metric-green">
                    <div className="exp-metric-label">
                      <TrendDownIcon /> Company Spent
                    </div>
                    <div className="exp-metric-value exp-metric-value-green">{money(site.companySpent)}</div>
                  </div>
                  <div className={`exp-metric ${site.managerPending > 0 ? "exp-metric-red" : "exp-metric-plain"}`}>
                    <div className="exp-metric-label">
                      <PersonSpendIcon /> Manager Pending
                    </div>
                    <div className={`exp-metric-value ${site.managerPending > 0 ? "exp-metric-value-red" : "exp-metric-value-muted"}`}>
                      {money(site.managerPending)}
                    </div>
                  </div>
                </div>

                {site.managerPending > 0 && (
                  <div className="exp-owed-banner">
                    <ReimburseIcon />
                    <span>
                      Manager is owed {money(site.managerPending)} — will auto-reimburse on next fund
                    </span>
                  </div>
                )}

                {site.recentExpenses.length > 0 && (
                  <div>
                    <div className="exp-recent-title">Recent Expenses</div>
                    {site.recentExpenses.map((e) => (
                      <div key={e.id} className="exp-recent-row">
                        <div className="exp-recent-note">
                          <span className="exp-recent-dot" />
                          {e.note || e.categoryName || "Uncategorized"}
                          {e.fundType === "SPLIT" && <span className="afs-badge afs-badge-split">SPLIT</span>}
                        </div>
                        <div className="exp-recent-amount">{money(e.amount)}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
