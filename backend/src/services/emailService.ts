
import nodemailer from "nodemailer";

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_APP_PASSWORD,
  },
});

function getFrontendUrl(): string {
  return (
    process.env.FRONTEND_URL ||
    "http://localhost:5173"
  ).replace(/\/$/, "");
}

export async function sendPasswordResetEmail(
  email: string,
  resetLink: string
): Promise<void> {
  await transporter.sendMail({
    from: `"Syncora Technologies" <${process.env.EMAIL_USER}>`,
    to: email,
    subject: "Reset Your Password",
    html: `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:auto">
        <h2>Password Reset</h2>
        <p>You requested to reset your password.</p>
        <a href="${resetLink}"
           style="display:inline-block;padding:12px 20px;background:#2563eb;color:white;text-decoration:none;border-radius:6px">
          Reset Password
        </a>
        <p>This link expires in 15 minutes.</p>
        <p>If you did not request this, ignore this email.</p>
      </div>
    `,
  });
}

export async function sendOwnerActivationEmail(
  email: string,
  activationLink: string,
  shopName: string
): Promise<void> {
  await transporter.sendMail({
    from: `"Syncora Technologies" <${process.env.EMAIL_USER}>`,
    to: email,
    subject: "Activate Your Shop Account",
    html: `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:auto">
        <h2>Welcome to Syncora</h2>
        <p>Your shop <strong>${shopName}</strong> has been registered.</p>
        <p>Click below to set your password and activate your account.</p>
        <a href="${activationLink}"
           style="display:inline-block;padding:12px 20px;background:#2563eb;color:white;text-decoration:none;border-radius:6px">
          Set Password & Activate
        </a>
        <p>This link expires in 15 minutes.</p>
        <p>If you were not expecting this email, please contact your administrator.</p>
      </div>
    `,
  });
}

export function createActivationLink(token: string): string {
  return `${getFrontendUrl()}/activate-account?token=${encodeURIComponent(token)}`;
}
