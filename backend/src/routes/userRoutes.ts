import { Router } from "express";
import { authenticate } from "../middleware/authMiddleware";
import {
  getUsers,
  createUser,
  updateUser,
  updateUserStatus,
  updateUserPassword,
} from "../controllers/userController";

const router = Router();

// Authentication is required for all user endpoints.
router.use(authenticate);

router.get("/", getUsers);
router.post("/", createUser);
router.put("/:id", updateUser);
router.patch("/:id/status", updateUserStatus);
router.patch("/:id/password", updateUserPassword);

export default router;
