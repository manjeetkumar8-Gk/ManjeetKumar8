
import { Router } from "express";
import {
  login,
  changePassword,
} from "../controllers/authController";
import { authenticate } from "../middleware/authMiddleware";
import { AuthRequest } from "../types/auth";

const router = Router();

router.post("/login", login);

router.post(
  "/change-password",
  authenticate,
  changePassword
);

router.get("/me", authenticate, (req: AuthRequest, res) => {
  res.status(200).json({
    success: true,
    user: req.user,
  });
});

export default router;
