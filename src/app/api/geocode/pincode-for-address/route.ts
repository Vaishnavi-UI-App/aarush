import { NextRequest, NextResponse } from "next/server";
import { requireSession, SessionError } from "@/lib/session";
import { pincodeForAddress } from "@/lib/reverse-geocode";

/** Looks up the pincode for a free-text address -- called when the New Site form's
 * Address field loses focus, to auto-fill Pincode instead of making the admin look it
 * up separately. */
export async function GET(request: NextRequest) {
  try {
    requireSession(request);
  } catch (e) {
    if (e instanceof SessionError) return NextResponse.json({ error: e.message }, { status: 401 });
    throw e;
  }

  const address = request.nextUrl.searchParams.get("address");
  if (!address || !address.trim()) {
    return NextResponse.json({ error: "address is required" }, { status: 400 });
  }

  const pincode = await pincodeForAddress(address);
  return NextResponse.json({ pincode });
}
