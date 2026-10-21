
import { Request, Response } from "express";
import { activateOwnerAccount } from "../services/ownerActivationService";

export async function activateOwner(
  req: Request,
  res: Response
): Promise<void> {
  try {
    const { token, newPassword } = req.body;

    if (
      typeof token !== "string" ||
      typeof newPassword !== "string"
    ) {
      res.status(400).json({
        success: false,
        message: "Activation token and password are required",
      });
      return;
    }

    await activateOwnerAccount(token, newPassword);

    res.status(200).json({
      success: true,
      message: "Account activated successfully. You can now log in.",
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Account activation failed";

    res.status(400).json({
      success: false,
      message,
    });
  }
}
