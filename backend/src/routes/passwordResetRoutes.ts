import { Router } from "express";
import {
  forgotPassword,
  resetPasswordController,
} from "../controllers/passwordResetController";

const router = Router();

router.post("/forgot-password", forgotPassword);

router.post(
  "/reset-password",
  resetPasswordController
);

export default router;