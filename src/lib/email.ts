import nodemailer from "nodemailer";
import { OTP_VALIDITY_MINUTES } from "./otp";

export interface SendOtpEmailParams {
  email: string;
  name?: string;
  otp: string;
  expiresAt: Date;
}

export interface SendEmailResult {
  success: boolean;
  messageId?: string;
  provider: "gmail" | "console";
  previewOtp?: string;
  error?: string;
}

/**
 * Builds the HTML email body for OTP verification
 */
function buildOtpEmailHtml(name: string | undefined, otp: string, expiresAt: Date): string {
  const greeting = name ? `Hi ${name},` : "Hello,";
  const formattedExpiryTime = expiresAt.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    timeZoneName: "short",
  });

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Your NAV Watcher Verification Code</title>
</head>
<body style="margin: 0; padding: 0; background-color: #0b1120; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #f8fafc;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #0b1120; padding: 40px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" style="max-width: 480px; background-color: #111a2e; border: 1px solid #1e293b; border-radius: 16px; overflow: hidden; box-shadow: 0 10px 25px rgba(0,0,0,0.5);">
          <!-- Header Accent Banner -->
          <tr>
            <td style="background: linear-gradient(90deg, #155360 0%, #33c6e4 100%); height: 6px;"></td>
          </tr>
          <tr>
            <td style="padding: 32px 32px 16px 32px; text-align: center;">
              <div style="display: inline-block; padding: 8px 16px; background-color: rgba(51, 198, 228, 0.12); border-radius: 9999px; border: 1px solid rgba(51, 198, 228, 0.3);">
                <span style="color: #33c6e4; font-size: 13px; font-weight: 700; letter-spacing: 0.5px;">NAV WATCHER</span>
              </div>
              <h1 style="color: #ffffff; font-size: 22px; font-weight: 700; margin: 16px 0 6px 0; letter-spacing: -0.3px;">
                Verify Your Email Address
              </h1>
              <p style="color: #94a3b8; font-size: 14px; margin: 0; line-height: 1.5;">
                ${greeting} please use the code below to complete your sign-up.
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding: 12px 32px; text-align: center;">
              <!-- OTP Box -->
              <div style="background-color: #0b1120; border: 1.5px dashed #33c6e4; border-radius: 12px; padding: 20px 16px; margin: 8px 0 16px 0;">
                <span style="font-family: 'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, Courier, monospace; font-size: 36px; font-weight: 800; letter-spacing: 10px; color: #33c6e4; display: inline-block; margin-left: 10px;">
                  ${otp}
                </span>
              </div>
              <!-- Expiry Alert -->
              <p style="color: #38bdf8; font-size: 13px; font-weight: 600; margin: 0 0 12px 0;">
                ⏳ This code expires in ${OTP_VALIDITY_MINUTES} minutes (around ${formattedExpiryTime}).
              </p>
              <p style="color: #64748b; font-size: 12px; line-height: 1.5; margin: 0;">
                If you did not request this verification code, please ignore this email or contact support. Never share this code with anyone.
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding: 24px 32px; text-align: center; border-top: 1px solid #1e293b; background-color: #0e1626;">
              <p style="color: #475569; font-size: 11px; margin: 0;">
                NAV Watcher &middot; Bangladesh Mutual Funds, SIP Tracker &amp; CIP Management
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim();
}

/**
 * Creates a Gmail SMTP transporter using an App Password.
 * Requires GMAIL_USER and GMAIL_APP_PASSWORD environment variables.
 */
function createGmailTransporter() {
  const user = process.env.GMAIL_USER;
  const pass = process.env.GMAIL_APP_PASSWORD;

  if (!user || !pass) {
    return null;
  }

  return nodemailer.createTransport({
    service: "gmail",
    auth: { user, pass },
  });
}

/**
 * Sends the OTP verification code via Gmail (Nodemailer).
 * Falls back to console logging in development when env vars are absent.
 */
export async function sendOtpEmail(params: SendOtpEmailParams): Promise<SendEmailResult> {
  const { email, name, otp, expiresAt } = params;

  const isDev = process.env.NODE_ENV !== "production";

  // Always log to server stdout for debugging
  console.log(`
┌────────────────────────────────────────────────────────┐
│ [NAV Watcher] EMAIL VERIFICATION OTP                   │
│ Recipient: ${email.padEnd(44)}│
│ Code:      ${otp.padEnd(44)}│
│ Validity:  ${OTP_VALIDITY_MINUTES} Minutes (Expires at: ${expiresAt.toISOString().slice(11, 19)}) │
└────────────────────────────────────────────────────────┘
  `.trim());

  const transporter = createGmailTransporter();

  // In production, require Gmail credentials
  if (!transporter && !isDev) {
    throw new Error(
      "Email provider not configured. Set GMAIL_USER and GMAIL_APP_PASSWORD in your Vercel environment variables.",
    );
  }

  if (transporter) {
    const fromName = process.env.EMAIL_FROM_NAME || "NAV Watcher";
    const fromAddress = process.env.GMAIL_USER!;
    const html = buildOtpEmailHtml(name, otp, expiresAt);
    const text = `Your NAV Watcher verification code is: ${otp}. Valid for ${OTP_VALIDITY_MINUTES} minutes.`;

    const info = await transporter.sendMail({
      from: `"${fromName}" <${fromAddress}>`,
      to: email,
      subject: `Your NAV Watcher Verification Code: ${otp}`,
      html,
      text,
    });

    console.log(`[Email Service] OTP sent via Gmail. MessageId: ${info.messageId}`);

    return {
      success: true,
      messageId: info.messageId,
      provider: "gmail",
      previewOtp: isDev ? otp : undefined,
    };
  }

  // Dev / offline fallback — console only
  return {
    success: true,
    provider: "console",
    previewOtp: otp,
  };
}
