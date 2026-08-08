"use client";

import { useState } from "react";
import { CalendarCheckIcon, PeopleIcon } from "@/components/icons";
import AttendanceCheckInOut, { TodayDTO, HistoryRecordDTO } from "./AttendanceCheckInOut";
import AttendanceAdminView from "./AttendanceAdminView";

interface StaffUser {
  id: string;
  name: string | null;
  email: string;
}

interface SiteOption {
  id: string;
  name: string;
}

export default function AttendanceTabs({
  canCheckIn,
  canViewAll,
  today,
  records,
  sites,
  staff,
}: {
  canCheckIn: boolean;
  canViewAll: boolean;
  today: TodayDTO | undefined;
  records: HistoryRecordDTO[];
  sites: SiteOption[];
  staff: StaffUser[];
}) {
  const [tab, setTab] = useState<"mine" | "all">(canCheckIn ? "mine" : "all");

  const showTabs = canCheckIn && canViewAll;

  return (
    <div>
      {showTabs && (
        <div className="att-tabs">
          <button type="button" onClick={() => setTab("mine")} className={`att-tab ${tab === "mine" ? "active" : ""}`}>
            <CalendarCheckIcon /> My Attendance
          </button>
          <button type="button" onClick={() => setTab("all")} className={`att-tab ${tab === "all" ? "active" : ""}`}>
            <PeopleIcon /> Attendance of All Users
          </button>
        </div>
      )}

      {(!showTabs || tab === "mine") && canCheckIn && <AttendanceCheckInOut today={today} records={records} sites={sites} />}
      {(!showTabs || tab === "all") && canViewAll && <AttendanceAdminView staff={staff} />}
    </div>
  );
}
