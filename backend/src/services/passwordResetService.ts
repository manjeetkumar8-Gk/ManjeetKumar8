import crypto from "crypto";
import bcrypt from "bcrypt";
import { pool } from "../config/db";
import { sendPasswordResetEmail } from "./emailService";

export async function requestPasswordReset(email: string) {
  const result = await pool.query(
    `
    SELECT id, email
    FROM users
    WHERE LOWER(email) = LOWER($1)
      AND status = 'active'
    LIMIT 1
    `,
    [email]
  );

  // Same response even if email does not exist
  if (result.rows.length === 0) {
    return;
  }

  const user = result.rows[0];

  // Delete previous unused tokens for this user
  await pool.query(
    `
    DELETE FROM password_reset_tokens
    WHERE user_id = $1
    `,
    [user.id]
  );

  // Generate secure random token
  const rawToken = crypto.randomBytes(32).toString("hex");

  // Store only hash in database
  const tokenHash = crypto
    .createHash("sha256")
    .update(rawToken)
    .digest("hex");

  // Token valid for 15 minutes
  const expiresAt = new Date(Date.now() + 15 * 60 * 1000);

  await pool.query(
    `
    INSERT INTO password_reset_tokens
      (user_id, token_hash, expires_at)
    VALUES
      ($1, $2, $3)
    `,
    [user.id, tokenHash, expiresAt]
  );

  const frontendUrl =
    process.env.FRONTEND_URL || "http://localhost:5173";

  const resetLink =
    `${frontendUrl}/reset-password?token=${rawToken}`;

  await sendPasswordResetEmail(
    user.email,
    resetLink
  );
}

export async function resetPassword(
  rawToken: string,
  newPassword: string
) {
  if (!rawToken || !newPassword) {
    throw new Error("Token and new password are required");
  }

  if (newPassword.length < 8) {
    throw new Error(
      "Password must be at least 8 characters"
    );
  }

  const tokenHash = crypto
    .createHash("sha256")
    .update(rawToken)
    .digest("hex");

  const result = await pool.query(
    `
    SELECT id, user_id
    FROM password_reset_tokens
    WHERE token_hash = $1
      AND expires_at > NOW()
      AND used_at IS NULL
    LIMIT 1
    `,
    [tokenHash]
  );

  if (result.rows.length === 0) {
    throw new Error(
      "Invalid or expired password reset link"
    );
  }

  const resetToken = result.rows[0];

  const passwordHash = await bcrypt.hash(
    newPassword,
    10
  );

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    await client.query(
      `
      UPDATE users
      SET password_hash = $1
      WHERE id = $2
      `,
      [passwordHash, resetToken.user_id]
    );

    await client.query(
      `
      UPDATE password_reset_tokens
      SET used_at = NOW()
      WHERE id = $1
      `,
      [resetToken.id]
    );

    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
