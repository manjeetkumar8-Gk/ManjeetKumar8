
import { Router } from "express";
import { authenticate } from "../middleware/authMiddleware";
import {
  getCurrentStock,
  getStockIn,
  createStockIn,
  getStockOut,
  createStockOut,
} from "../controllers/stockController";

const router = Router();

router.use(authenticate);

router.get("/current", getCurrentStock);
router.get("/in", getStockIn);
router.post("/in", createStockIn);
router.get("/out", getStockOut);
router.post("/out", createStockOut);

export default router;
