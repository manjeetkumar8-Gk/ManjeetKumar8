import { Request, Response } from "express";
import {
  requestPasswordReset,
  resetPassword,
} from "../services/passwordResetService";

export async function forgotPassword(
  req: Request,
  res: Response
): Promise<void> {
  try {
    const { email } = req.body;

    if (!email) {
      res.status(400).json({
        success: false,
        message: "Email is required",
      });
      return;
    }

    await requestPasswordReset(email);

    res.status(200).json({
      success: true,
      message:
        "If this email is registered, a password reset link has been sent.",
    });
  } catch (error) {
    console.error("Forgot password error:", error);

    res.status(500).json({
      success: false,
      message: "Unable to process password reset request",
    });
  }
}

export async function resetPasswordController(
  req: Request,
  res: Response
): Promise<void> {
  try {
    const { token, newPassword } = req.body;

    if (!token || !newPassword) {
      res.status(400).json({
        success: false,
        message: "Token and new password are required",
      });
      return;
    }

    await resetPassword(token, newPassword);

    res.status(200).json({
      success: true,
      message: "Password reset successful",
    });
  } catch (error) {
    console.error("Reset password error:", error);

    res.status(400).json({
      success: false,
      message:
        error instanceof Error
          ? error.message
          : "Password reset failed",
    });
  }
}
