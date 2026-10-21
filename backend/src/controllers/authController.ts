
import { Request, Response } from "express";
import bcrypt from "bcrypt";
import { pool } from "../config/db";
import { AuthRequest } from "../types/auth";
import { loginUser } from "../services/authService";

export async function login(
  req: Request,
  res: Response
): Promise<void> {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      res.status(400).json({
        success: false,
        message: "Username and password are required",
      });
      return;
    }

    const result = await loginUser(username, password);

    res.status(200).json({
      success: true,
      message: "Login successful",
      token: result.token,
      user: result.user,
    });
  } catch (error) {
    console.error("Login error:", error);

    res.status(401).json({
      success: false,
      message:
        error instanceof Error
          ? error.message
          : "Login failed",
    });
  }
}

export async function changePassword(
  req: AuthRequest,
  res: Response
): Promise<void> {
  try {
    const userId = req.user?.id;
    const {
      currentPassword,
      newPassword,
      confirmPassword,
    } = req.body;

    if (!userId) {
      res.status(401).json({
        success: false,
        message: "Authentication required",
      });
      return;
    }

    if (
      typeof currentPassword !== "string" ||
      typeof newPassword !== "string" ||
      typeof confirmPassword !== "string" ||
      !currentPassword ||
      !newPassword ||
      !confirmPassword
    ) {
      res.status(400).json({
        success: false,
        message: "All password fields are required",
      });
      return;
    }

    if (newPassword.length < 8) {
      res.status(400).json({
        success: false,
        message: "New password must be at least 8 characters",
      });
      return;
    }

    if (newPassword !== confirmPassword) {
      res.status(400).json({
        success: false,
        message: "New password and confirm password do not match",
      });
      return;
    }

    if (currentPassword === newPassword) {
      res.status(400).json({
        success: false,
        message: "New password must differ from current password",
      });
      return;
    }

    const result = await pool.query(
      "SELECT password_hash FROM users WHERE id = $1 LIMIT 1",
      [userId]
    );

    if (result.rows.length === 0) {
      res.status(404).json({
        success: false,
        message: "User not found",
      });
      return;
    }

    const passwordValid = await bcrypt.compare(
      currentPassword,
      result.rows[0].password_hash
    );

    if (!passwordValid) {
      res.status(400).json({
        success: false,
        message: "Current password is incorrect",
      });
      return;
    }

    const passwordHash = await bcrypt.hash(newPassword, 12);

    await pool.query(
      "UPDATE users SET password_hash = $1 WHERE id = $2",
      [passwordHash, userId]
    );

    res.status(200).json({
      success: true,
      message: "Password updated successfully",
    });
  } catch (error) {
    console.error("Change password error:", error);

    res.status(500).json({
      success: false,
      message: "Unable to update password",
    });
  }
}
