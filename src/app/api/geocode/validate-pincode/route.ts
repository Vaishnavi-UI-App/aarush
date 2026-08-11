import { NextRequest, NextResponse } from "next/server";
import { requireSession, SessionError } from "@/lib/session";
import { checkPincodeMatchesAddress } from "@/lib/reverse-geocode";

/** Cross-checks a typed pincode against a typed address -- called before the New Site
 * form submits, so a pincode that plainly belongs to a different city than the address
 * gets caught before the site is created with a wrong location. */
export async function GET(request: NextRequest) {
  try {
    requireSession(request);
  } catch (e) {
    if (e instanceof SessionError) return NextResponse.json({ error: e.message }, { status: 401 });
    throw e;
  }

  const address = request.nextUrl.searchParams.get("address");
  const pincode = request.nextUrl.searchParams.get("pincode");
  if (!address || !address.trim() || !pincode || !pincode.trim()) {
    return NextResponse.json({ error: "address and pincode are both required" }, { status: 400 });
  }

  const result = await checkPincodeMatchesAddress(address, pincode);
  return NextResponse.json(result);
}
