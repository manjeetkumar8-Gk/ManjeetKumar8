
import { Response, NextFunction } from "express";
import { AuthRequest } from "../types/auth";

export function requireSuperAdmin(
  req: AuthRequest,
  res: Response,
  next: NextFunction
) {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      message: "Authentication required",
    });
  }

  if (req.user.role_name !== "Super Admin") {
    return res.status(403).json({
      success: false,
      message: "Super Admin access only",
    });
  }

  next();
}
