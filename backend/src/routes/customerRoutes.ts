import { Router } from "express";

import {
  getCustomers,
  createCustomer,
  updateCustomer,
  deleteCustomer,
} from "../controllers/customerController";

import { authenticate } from "../middleware/authMiddleware";

const router = Router();

router.use(authenticate);

router.get("/", getCustomers);
router.post("/", createCustomer);
router.put("/:id", updateCustomer);
router.delete("/:id", deleteCustomer);

export default router;