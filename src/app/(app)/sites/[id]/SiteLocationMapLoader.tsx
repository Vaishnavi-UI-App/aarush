"use client";

import dynamic from "next/dynamic";

// Leaflet touches `window` at module load time, so it can't be server-rendered -- this
// client-only wrapper is what makes `ssr: false` legal (next/dynamic forbids that option
// inside a Server Component, which sites/[id]/page.tsx is).
const SiteLocationMap = dynamic(() => import("./SiteLocationMap"), {
  ssr: false,
  loading: () => <div className="afs-empty">Loading map…</div>,
});

export default SiteLocationMap;
