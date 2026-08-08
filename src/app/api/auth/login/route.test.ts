import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const findUniqueMock = vi.fn();
const verifyPasswordMock = vi.fn();

vi.mock("@/lib/prisma", () => ({
  prisma: { user: { findUnique: (...args: unknown[]) => findUniqueMock(...args) } },
}));

vi.mock("@/lib/password", () => ({
  verifyPassword: (...args: unknown[]) => verifyPasswordMock(...args),
}));

process.env.SESSION_SECRET = "test-session-secret";

function makeRequest(body: unknown) {
  return new NextRequest("http://localhost/api/auth/login", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "content-type": "application/json" },
  });
}

describe("POST /api/auth/login -- user-enumeration timing side-channel", () => {
  beforeEach(() => {
    findUniqueMock.mockReset();
    verifyPasswordMock.mockReset();
  });

  it("still runs a password verification (constant-time work) when the email does not exist", async () => {
    // The route currently does `if (!user || !(await verifyPassword(...)))`, which
    // short-circuits on a null user and never calls verifyPassword at all. That makes a
    // nonexistent-email response measurably faster than a wrong-password response
    // (skips an entire scrypt derivation), letting an attacker enumerate registered
    // emails purely from response latency -- no credentials needed.
    findUniqueMock.mockResolvedValue(null); // no such user
    const { POST } = await import("./route");

    await POST(makeRequest({ email: "nobody@example.com", password: "whatever123" }));

    expect(verifyPasswordMock).toHaveBeenCalled();
  });

  it("returns the same generic error for a nonexistent email and a wrong password (no message-content leak)", async () => {
    findUniqueMock.mockResolvedValue(null);
    verifyPasswordMock.mockResolvedValue(false);
    const { POST } = await import("./route");

    const resNoUser = await POST(makeRequest({ email: "nobody@example.com", password: "x" }));
    const bodyNoUser = await resNoUser.json();

    findUniqueMock.mockResolvedValue({ id: "u1", email: "real@example.com", passwordHash: "scrypt:aa:bb", roleId: "r1", tenantId: "t1" });
    const resWrongPassword = await POST(makeRequest({ email: "real@example.com", password: "wrong" }));
    const bodyWrongPassword = await resWrongPassword.json();

    expect(resNoUser.status).toBe(resWrongPassword.status);
    expect(bodyNoUser.error).toBe(bodyWrongPassword.error);
  });
});
