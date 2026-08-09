"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { computeElapsedHours, formatHMS } from "@/lib/attendance-hours";
import { CalendarCheckIcon, CheckCircleIcon, PeopleIcon } from "@/components/icons";
import "./staff-dashboard.css";

interface Punch {
  kind: "CHECK_IN" | "CHECK_OUT";
  at: string;
}

interface Break {
  startAt: string;
  endAt: string | null;
}

interface TodayDTO {
  status: string;
  punches: Punch[];
  breaks: Break[];
}

interface MonthStats {
  presentDays: number;
  halfDays: number;
  absentDays: number;
  lateCount: number;
  totalHours: number;
}

interface UserInfo {
  name: string | null;
  email: string;
  photoData: string | null;
  roleName: string;
}

function greeting(): string {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

export default function StaffDashboard({ user, today, monthStats }: { user: UserInfo; today: TodayDTO | null; monthStats: MonthStats }) {
  const [now, setNow] = useState(() => Date.now());
  const punches = today?.punches ?? [];
  const breaks = today?.breaks ?? [];
  const lastPunch = punches[punches.length - 1];
  const checkedIn = lastPunch?.kind === "CHECK_IN";
  const onBreak = breaks.some((b) => !b.endAt);

  useEffect(() => {
    if (!checkedIn) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [checkedIn]);

  const elapsedHours = computeElapsedHours(punches, breaks, now);
  const initials =
    (user.name || user.email)
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((w) => w[0]?.toUpperCase())
      .join("") || "?";

  const statusLabel = onBreak ? "On a break" : checkedIn ? "Checked in" : "Not checked in";
  const statusClass = onBreak ? "sd-status-break" : checkedIn ? "sd-status-in" : "sd-status-out";

  return (
    <div className="sd-page">
      <div className="sd-hero">
        <div className="sd-hero-left">
          {user.photoData ? (
            <img src={user.photoData} alt="" className="sd-avatar-img" />
          ) : (
            <div className="sd-avatar-fallback">{initials}</div>
          )}
          <div>
            <div className="sd-greeting">
              {greeting()}, {user.name || user.email}
            </div>
            <div className="sd-role">{user.roleName}</div>
          </div>
        </div>
        <div className={`sd-status-chip ${statusClass}`}>
          <span className="sd-status-dot" />
          {statusLabel}
        </div>
      </div>

      <div className="sd-grid">
        <div className="sd-card sd-card-timer">
          <div className="sd-card-label">Worked today</div>
          <div className="sd-timer">{formatHMS(elapsedHours)}</div>
          <Link href="/attendance" className="afs-btn afs-btn-primary" style={{ marginTop: 14, justifyContent: "center" }}>
            <CalendarCheckIcon />
            {checkedIn ? "Go to Attendance" : "Check In"}
          </Link>
        </div>

        <div className="sd-stat-col">
          <div className="sd-stat-row">
            <div className="sd-mini-card">
              <div className="sd-mini-icon sd-mini-icon-green">
                <CheckCircleIcon />
              </div>
              <div>
                <div className="sd-mini-value">{monthStats.presentDays}</div>
                <div className="sd-mini-label">Present days</div>
              </div>
            </div>
            <div className="sd-mini-card">
              <div className="sd-mini-icon sd-mini-icon-blue">
                <CalendarCheckIcon />
              </div>
              <div>
                <div className="sd-mini-value">{monthStats.totalHours.toFixed(1)}h</div>
                <div className="sd-mini-label">Hours this month</div>
              </div>
            </div>
          </div>
          <div className="sd-stat-row">
            <div className="sd-mini-card">
              <div className="sd-mini-icon sd-mini-icon-amber">
                <CalendarCheckIcon />
              </div>
              <div>
                <div className="sd-mini-value">{monthStats.halfDays}</div>
                <div className="sd-mini-label">Half days</div>
              </div>
            </div>
            <div className="sd-mini-card">
              <div className="sd-mini-icon sd-mini-icon-rose">
                <CalendarCheckIcon />
              </div>
              <div>
                <div className="sd-mini-value">{monthStats.absentDays}</div>
                <div className="sd-mini-label">Absent days</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <Link href="/profile" className="sd-profile-cta">
        <div className="sd-profile-cta-icon">
          <PeopleIcon />
        </div>
        <div style={{ flex: 1 }}>
          <div className="sd-profile-cta-title">My Profile</div>
          <div className="sd-profile-cta-sub">Add your photo, phone number, and basic details</div>
        </div>
        <span className="sd-profile-cta-arrow">→</span>
      </Link>

      <div className="sd-quicklinks">
        <Link href="/attendance" className="sd-quicklink">
          Attendance history
        </Link>
        <Link href="/expenses" className="sd-quicklink">
          Log an expense
        </Link>
      </div>
    </div>
  );
}
