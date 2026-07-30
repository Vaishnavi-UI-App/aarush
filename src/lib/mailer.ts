import nodemailer from "nodemailer";

export interface SendMailInput {
  to: string;
  subject: string;
  text: string;
  attachments?: { filename: string; content: Buffer }[];
}

type Transport = ReturnType<typeof nodemailer.createTransport>;

let transport: Transport | null = null;

function getTransport(): Transport {
  if (transport) return transport;

  const host = process.env.SMTP_HOST;
  const port = process.env.SMTP_PORT;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (!host || !port || !user || !pass) {
    throw new Error("SMTP is not configured. Set SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS in .env.local.");
  }

  transport = nodemailer.createTransport({
    host,
    port: Number(port),
    secure: process.env.SMTP_SECURE !== "false", // true (465, implicit TLS) unless explicitly disabled
    auth: { user, pass },
  });

  return transport;
}

/** Sends an email via SMTP (e.g. Gmail with an App Password). Throws if SMTP env
 * vars are missing or the send fails -- callers decide how to surface that. */
export async function sendMail(input: SendMailInput): Promise<void> {
  const from = process.env.EMAIL_FROM || process.env.SMTP_USER;
  await getTransport().sendMail({
    from,
    to: input.to,
    subject: input.subject,
    text: input.text,
    attachments: input.attachments,
  });
}
