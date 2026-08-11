import { NextRequest, NextResponse } from "next/server";
import { requireSession, SessionError } from "@/lib/session";
import { geocodeAddress } from "@/lib/reverse-geocode";

/** Forward-geocodes a place name/address to coordinates -- called from the client-side
 * site location picker, kept server-side so the Nominatim User-Agent stays controlled
 * and the browser doesn't need a direct cross-origin call. */
export async function GET(request: NextRequest) {
  try {
    requireSession(request);
  } catch (e) {
    if (e instanceof SessionError) return NextResponse.json({ error: e.message }, { status: 401 });
    throw e;
  }

  const q = request.nextUrl.searchParams.get("q");
  if (!q || !q.trim()) {
    return NextResponse.json({ error: "q is required" }, { status: 400 });
  }

  const result = await geocodeAddress(q);
  if (!result) {
    return NextResponse.json({ error: "No location found for that search" }, { status: 404 });
  }
  return NextResponse.json(result);
}
