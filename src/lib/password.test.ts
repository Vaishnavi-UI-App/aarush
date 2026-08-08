import crypto from "node:crypto";
import { afterEach, describe, expect, it, vi } from "vitest";
import { generateRandomPassword } from "./password";

describe("generateRandomPassword -- modulo bias in the character mapping", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("does not map raw bytes to characters with a uniform distribution (57 does not divide 256)", () => {
    // generateRandomPassword picks each character via
    // RANDOM_PASSWORD_CHARS[byte % RANDOM_PASSWORD_CHARS.length], with a 57-character
    // alphabet. 256 is not a multiple of 57 (256 = 4*57 + 28), so byte values 0..255
    // don't map onto the 57 characters evenly: the first 28 characters are reachable by
    // 5 distinct byte values each, the remaining 29 by only 4 -- a ~25% higher selection
    // probability for the first 28 characters of the alphabet than the rest. This is
    // deterministic (every one of the 256 possible byte values is fed through exactly
    // once below), not a statistical/flaky claim.
    let call = 0;
    vi.spyOn(crypto, "randomBytes").mockImplementation(((size: number) => {
      const buf = Buffer.alloc(size);
      for (let i = 0; i < size; i++) buf[i] = (call + i) % 256;
      call += size;
      return buf;
    }) as typeof crypto.randomBytes);

    const seen = new Map<string, number>();
    // 256 single-character passwords, one for every possible byte value 0..255.
    for (let i = 0; i < 256; i++) {
      const ch = generateRandomPassword(1);
      seen.set(ch, (seen.get(ch) ?? 0) + 1);
    }

    const counts = [...seen.values()];
    const min = Math.min(...counts);
    const max = Math.max(...counts);

    // A uniform mapping would give every character exactly the same count (256/57 is
    // not an integer, so "uniform" isn't achievable exactly -- but a *correct* unbiased
    // generator, e.g. rejection sampling, would only ever differ by design, not produce
    // a fixed structural 5-vs-4 split). Asserting the actually-correct property: no
    // character should be selectable by more raw byte values than any other.
    expect(min).toBe(max);
  });
});
