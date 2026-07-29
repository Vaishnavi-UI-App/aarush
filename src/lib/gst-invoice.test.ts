import { describe, expect, it } from "vitest";
import { calculateTaxSplit } from "./gst-invoice";

describe("calculateTaxSplit", () => {
  it("splits into CGST + SGST evenly when buyer and seller are in the same state", () => {
    const result = calculateTaxSplit(1000, 18, "27", "27");
    expect(result).toEqual({ cgst: 90, sgst: 90, igst: 0 });
  });

  it("charges IGST only when buyer and seller are in different states", () => {
    const result = calculateTaxSplit(1000, 18, "27", "29");
    expect(result).toEqual({ cgst: 0, sgst: 0, igst: 180 });
  });

  it("keeps CGST + SGST summing exactly to the rounded tax on an odd-paisa taxable value", () => {
    // 100.01 @ 18% = 18.0018 -> rounds to 18.00, which does not split evenly in half.
    const result = calculateTaxSplit(100.01, 18, "27", "27");
    expect(result.cgst + result.sgst).toBeCloseTo(18.0, 2);
    expect(result.igst).toBe(0);
    // Neither half should silently drop a paisa relative to the rounded total.
    expect(Math.abs(result.cgst - result.sgst)).toBeLessThanOrEqual(0.01);
  });

  it("keeps the rounded IGST total for an odd-paisa taxable value in a different state", () => {
    // 33.33 @ 12% = 3.9996 -> rounds to 4.00
    const result = calculateTaxSplit(33.33, 12, "27", "07");
    expect(result.igst).toBe(4.0);
    expect(result.cgst).toBe(0);
    expect(result.sgst).toBe(0);
  });
});
