// GST state codes we're likely to see. Falls back to the raw code if unknown --
// good enough for display purposes without needing the full 37-entry table.
const STATE_NAMES: Record<string, string> = {
  "27": "Maharashtra",
  "29": "Karnataka",
  "07": "Delhi",
  "33": "Tamil Nadu",
  "24": "Gujarat",
  "06": "Haryana",
  "09": "Uttar Pradesh",
  "19": "West Bengal",
  "36": "Telangana",
  "08": "Rajasthan",
};

export function stateName(stateCode: string): string {
  return STATE_NAMES[stateCode] ?? `State Code ${stateCode}`;
}
