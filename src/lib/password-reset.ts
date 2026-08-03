import crypto from "node:crypto";
import { prisma } from "@/lib/prisma";
import { sendMail } from "@/lib/mailer";

const TOKEN_TTL_MS = 60 * 60 * 1000; // 1 hour

function hashToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

/** Generates a password-reset token for an existing user, stores its hash, and emails
 * the raw token as a link -- the self-service "forgot password" flow on the login page. */
export async function sendPasswordSetupEmail(
  user: { id: string; email: string; name: string | null },
  appBaseUrl: string
): Promise<void> {
  const token = crypto.randomBytes(32).toString("base64url");

  await prisma.passwordResetToken.create({
    data: {
      userId: user.id,
      tokenHash: hashToken(token),
      expiresAt: new Date(Date.now() + TOKEN_TTL_MS),
    },
  });

  const link = `${appBaseUrl}/reset-password?token=${token}`;
  const greetingName = user.name || user.email;

  await sendMail({
    to: user.email,
    subject: "Reset your password",
    text: `Hi ${greetingName},\n\nWe received a request to reset your password. Set a new one here (link expires in 1 hour):\n${link}\n\nIf you didn't request this, you can ignore this email -- your password won't change.`,
  });
}

/** Emails a newly-invited (or re-invited) user their login link, email, and a
 * ready-to-use password -- used by OWNER's Settings > Users "Add User"/"Resend invite". */
export async function sendWelcomeCredentialsEmail(
  user: { email: string; name: string | null },
  password: string,
  appBaseUrl: string
): Promise<void> {
  const greetingName = user.name || user.email;
  const loginUrl = `${appBaseUrl}/login`;

  await sendMail({
    to: user.email,
    subject: "Your Aarush Fire Protection Systems account is ready",
    text: `Hi ${greetingName},\n\nAn account has been created for you on the Aarush Fire Protection Systems billing app.\n\nSign in here: ${loginUrl}\nEmail: ${user.email}\nPassword: ${password}\n\nYou can change your password anytime from the "Forgot password?" link on the sign-in page.`,
  });
}

/** Verifies a raw reset token, consumes it, and returns the associated userId -- or null
 * if the token is missing, expired, or already used. */
export async function consumePasswordResetToken(token: string): Promise<string | null> {
  const record = await prisma.passwordResetToken.findUnique({ where: { tokenHash: hashToken(token) } });
  if (!record || record.usedAt || record.expiresAt < new Date()) return null;

  await prisma.passwordResetToken.update({ where: { id: record.id }, data: { usedAt: new Date() } });
  return record.userId;
}
