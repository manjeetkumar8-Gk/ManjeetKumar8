
import crypto from "crypto";
import bcrypt from "bcrypt";
import { pool } from "../config/db";
import { sendOwnerActivationEmail, createActivationLink } from "./emailService";

export async function createOwnerActivation(
  userId: number,
  email: string,
  shopName: string
): Promise<void> {
  const rawToken = crypto.randomBytes(32).toString("hex");

  const tokenHash = crypto
    .createHash("sha256")
    .update(rawToken)
    .digest("hex");

  const expiresAt = new Date(Date.now() + 15 * 60 * 1000);

  await pool.query(
    `INSERT INTO password_reset_tokens
      (user_id, token_hash, expires_at, used_at, created_at)
     VALUES ($1, $2, $3, NULL, NOW())`,
    [userId, tokenHash, expiresAt]
  );

  const activationLink = createActivationLink(rawToken);

  await sendOwnerActivationEmail(
    email,
    activationLink,
    shopName
  );
}

export async function activateOwnerAccount(
  rawToken: string,
  newPassword: string
): Promise<void> {
  if (!rawToken || !newPassword) {
    throw new Error("Token and new password are required");
  }

  if (newPassword.length < 8) {
    throw new Error("Password must be at least 8 characters");
  }

  const tokenHash = crypto
    .createHash("sha256")
    .update(rawToken)
    .digest("hex");

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const tokenResult = await client.query(
      `SELECT id, user_id
       FROM password_reset_tokens
       WHERE token_hash = $1
         AND expires_at > NOW()
         AND used_at IS NULL
       FOR UPDATE`,
      [tokenHash]
    );

    if (!tokenResult.rows.length) {
      throw new Error("Invalid or expired activation link");
    }

    const token = tokenResult.rows[0];

    const userResult = await client.query(
      `SELECT id, status
       FROM users
       WHERE id = $1
       FOR UPDATE`,
      [token.user_id]
    );

    if (!userResult.rows.length) {
      throw new Error("Account not found");
    }

    if (userResult.rows[0].status === "active") {
      throw new Error("Account is already active");
    }

    const passwordHash = await bcrypt.hash(newPassword, 10);

    await client.query(
      `UPDATE users
       SET password_hash = $1,
           status = 'active',
           updated_at = NOW()
       WHERE id = $2`,
      [passwordHash, token.user_id]
    );

    await client.query(
      `UPDATE password_reset_tokens
       SET used_at = NOW()
       WHERE id = $1`,
      [token.id]
    );

    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
