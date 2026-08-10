import "server-only";
import nodemailer from "nodemailer";
import { env } from "./env";

function fromAddress(): string {
  const address = (env.EMAIL_HOST_USER || "").trim() || "no-reply@example.com";
  const name = (process.env.EMAIL_SENDER_NAME || "").trim() || "CHATBOT ADMIN Panel";
  return `${name} <${address}>`;
}

async function sendMail(subject: string, message: string, to: string): Promise<void> {
  if (!env.EMAIL_HOST) {
    // Dev fallback: no SMTP configured. Log the code so local flows still work.
    console.log(`[email:dev] To ${to} | ${subject}\n${message}`);
    return;
  }
  try {
    const transport = nodemailer.createTransport({
      host: env.EMAIL_HOST,
      port: env.EMAIL_PORT,
      secure: env.EMAIL_PORT === 465,
      requireTLS: env.EMAIL_USE_TLS,
      auth: env.EMAIL_HOST_USER ? { user: env.EMAIL_HOST_USER, pass: env.EMAIL_HOST_PASSWORD } : undefined,
    });
    await transport.sendMail({ from: fromAddress(), to, subject, text: message });
  } catch {
    // Match Django fail_silently behavior.
  }
}

/** Fire-and-forget, mirrors Django _run_in_background threading. */
export function runInBackground(fn: () => Promise<void>): void {
  void fn().catch(() => {
    /* background tasks must not crash the request */
  });
}

export function sendVerificationEmail(email: string, code: string): Promise<void> {
  const subject = "ACME ONE Admin Email Verification Code";
  const message =
    "Welcome to ACME ONE.\n\n" +
    "Use the verification code below to confirm your admin email address:\n\n" +
    `${code}\n\n` +
    "This code expires in 30 minutes.\n" +
    "If you did not request this, you can ignore this email.";
  return sendMail(subject, message, email);
}

export function sendPasswordResetEmail(email: string, code: string): Promise<void> {
  const subject = "ACME ONE Admin Password Reset Code";
  const message =
    "We received a request to reset your ACME ONE admin password.\n\n" +
    "Use the reset code below to set a new password:\n\n" +
    `${code}\n\n` +
    "This code expires in 30 minutes.\n" +
    "If you did not request a password reset, you can ignore this email.";
  return sendMail(subject, message, email);
}
