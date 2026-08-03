import crypto from "node:crypto";

const KEY_LENGTH = 64;

/** Hashes a plaintext password with scrypt. Stored as "scrypt:<saltHex>:<hashHex>". */
export async function hashPassword(plain: string): Promise<string> {
  const salt = crypto.randomBytes(16).toString("hex");
  const derived = await scrypt(plain, salt);
  return `scrypt:${salt}:${derived.toString("hex")}`;
}

/** Verifies a plaintext password against a stored hash. Timing-safe compare. */
export async function verifyPassword(plain: string, stored: string): Promise<boolean> {
  const [scheme, salt, hashHex] = stored.split(":");
  if (scheme !== "scrypt" || !salt || !hashHex) return false;

  const derived = await scrypt(plain, salt);
  const expected = Buffer.from(hashHex, "hex");
  if (derived.length !== expected.length) return false;
  return crypto.timingSafeEqual(derived, expected);
}

function scrypt(plain: string, salt: string): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    crypto.scrypt(plain, salt, KEY_LENGTH, (err, derivedKey) => {
      if (err) reject(err);
      else resolve(derivedKey);
    });
  });
}

// Excludes visually-ambiguous characters (0/O, 1/l/I) since this is meant to be read
// out of an email and typed in, not just machine-generated.
const RANDOM_PASSWORD_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";

/** Generates a random password for a newly-invited user to log in with immediately. */
export function generateRandomPassword(length = 12): string {
  const bytes = crypto.randomBytes(length);
  let out = "";
  for (let i = 0; i < length; i++) {
    out += RANDOM_PASSWORD_CHARS[bytes[i] % RANDOM_PASSWORD_CHARS.length];
  }
  return out;
}
