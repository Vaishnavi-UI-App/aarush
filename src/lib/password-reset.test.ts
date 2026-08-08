import { beforeEach, describe, expect, it, vi } from "vitest";

const findUniqueMock = vi.fn();
const updateMock = vi.fn().mockResolvedValue({});

vi.mock("@/lib/prisma", () => ({
  prisma: {
    passwordResetToken: {
      findUnique: (...args: unknown[]) => findUniqueMock(...args),
      update: (...args: unknown[]) => updateMock(...args),
    },
  },
}));

vi.mock("@/lib/mailer", () => ({ sendMail: vi.fn() }));

describe("consumePasswordResetToken -- single-use is not enforced atomically", () => {
  beforeEach(() => {
    findUniqueMock.mockReset();
    updateMock.mockClear();
  });

  it("only lets a reset token be consumed once, even under two racing requests", async () => {
    const { consumePasswordResetToken } = await import("./password-reset");

    // consumePasswordResetToken does a plain findUnique() followed by a *separate*
    // update() to set usedAt -- there is no single atomic
    // "UPDATE ... WHERE usedAt IS NULL RETURNING" and no DB-level guard. Two concurrent
    // requests for the same token both read usedAt: null before either write lands, so
    // both pass the check and both successfully set a new password. Simulated here by
    // having findUnique keep returning the same "not yet used" record across both calls
    // (exactly what two requests racing ahead of each other's write would each observe).
    const record = { id: "prt-1", userId: "user-1", tokenHash: "hash", usedAt: null, expiresAt: new Date(Date.now() + 60_000) };
    findUniqueMock.mockResolvedValue(record);

    const firstResult = await consumePasswordResetToken("raw-token");
    const secondResult = await consumePasswordResetToken("raw-token");

    expect(firstResult).toBe("user-1");
    // The second "concurrent" consumption of the same token must be rejected -- a reset
    // link is meant to be single-use.
    expect(secondResult).toBeNull();
  });
});
