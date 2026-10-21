import { Router } from "express";
import { authenticate } from "../middleware/authMiddleware";
import { requireSuperAdmin } from "../middleware/requireSuperAdmin";
import {
  getDashboardStats,
  getShops,
  createShop,
  updateShop,
  updateShopStatus,
  deleteShop,
  getSubscriptions,
  updateShopSubscription,
} from "../controllers/superAdminController";

const router = Router();

// Login and Super Admin permission are required for all endpoints.
router.use(authenticate, requireSuperAdmin);

router.get("/dashboard", getDashboardStats);
router.get("/shops", getShops);
router.post("/shops", createShop);
router.put("/shops/:id", updateShop);
router.patch("/shops/:id/status", updateShopStatus);
router.delete("/shops/:id", deleteShop);

// Subscription management
router.get("/subscriptions", getSubscriptions);
router.patch("/shops/:id/subscription", updateShopSubscription);

export default router;
