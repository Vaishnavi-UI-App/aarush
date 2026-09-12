// The official GST state/UT code table. This started as a handful of states we happened
// to trade with, falling back to the raw code for anything else -- fine for displaying a
// place of supply on an invoice PDF, but not for GSTR-1, which is filed with the
// department and must carry the real state name for every code that can appear.
const STATE_NAMES: Record<string, string> = {
  "01": "Jammu and Kashmir",
  "02": "Himachal Pradesh",
  "03": "Punjab",
  "04": "Chandigarh",
  "05": "Uttarakhand",
  "06": "Haryana",
  "07": "Delhi",
  "08": "Rajasthan",
  "09": "Uttar Pradesh",
  "10": "Bihar",
  "11": "Sikkim",
  "12": "Arunachal Pradesh",
  "13": "Nagaland",
  "14": "Manipur",
  "15": "Mizoram",
  "16": "Tripura",
  "17": "Meghalaya",
  "18": "Assam",
  "19": "West Bengal",
  "20": "Jharkhand",
  "21": "Odisha",
  "22": "Chhattisgarh",
  "23": "Madhya Pradesh",
  "24": "Gujarat",
  // 25 (Daman and Diu) and 26 (Dadra and Nagar Haveli) were merged into a single UT in
  // 2020, which kept code 26. Code 25 is retained here so invoices raised before the
  // merger still render with a name instead of a bare number.
  "25": "Daman and Diu",
  "26": "Dadra and Nagar Haveli and Daman and Diu",
  "27": "Maharashtra",
  // Likewise 28: the pre-bifurcation Andhra Pradesh code, superseded by 37.
  "28": "Andhra Pradesh",
  "29": "Karnataka",
  "30": "Goa",
  "31": "Lakshadweep",
  "32": "Kerala",
  "33": "Tamil Nadu",
  "34": "Puducherry",
  "35": "Andaman and Nicobar Islands",
  "36": "Telangana",
  "37": "Andhra Pradesh",
  "38": "Ladakh",
  "97": "Other Territory",
  "99": "Centre Jurisdiction",
};

/** Normalises a state code to the 2-digit form the table is keyed by, so a code stored
 * as "7" still resolves to Delhi. */
export function normalizeStateCode(stateCode: string): string {
  return String(stateCode ?? "").trim().padStart(2, "0");
}

export function stateName(stateCode: string): string {
  const code = normalizeStateCode(stateCode);
  return STATE_NAMES[code] ?? `State Code ${stateCode}`;
}

/** "27-Maharashtra" -- the format the GST offline tool expects for Place of Supply. */
export function placeOfSupplyLabel(stateCode: string): string {
  return `${normalizeStateCode(stateCode)}-${stateName(stateCode)}`;
}
