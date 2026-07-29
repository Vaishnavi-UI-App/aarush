"use client";

import { useEffect, useState } from "react";

type Theme = "light" | "dark";

const STORAGE_KEY = "afs-dashboard-theme";

export default function ThemeShell({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<Theme>("light");

  useEffect(() => {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored === "light" || stored === "dark") setTheme(stored);
  }, []);

  function choose(next: Theme) {
    setTheme(next);
    window.localStorage.setItem(STORAGE_KEY, next);
  }

  return (
    <div className="afs-dash" data-theme={theme}>
      <div className="dd-toolbar">
        <div>
          <h1 className="afs-page-title">Dashboard</h1>
          <p className="afs-page-subtitle">Overview of your billing activity</p>
        </div>
        <div className="dd-theme-toggle">
          <button type="button" className={theme === "light" ? "active" : ""} onClick={() => choose("light")}>
            ☀ Light
          </button>
          <button type="button" className={theme === "dark" ? "active" : ""} onClick={() => choose("dark")}>
            🌙 Dark
          </button>
        </div>
      </div>
      {children}
    </div>
  );
}
