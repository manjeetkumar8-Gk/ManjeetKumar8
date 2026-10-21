import { Router } from "express";
import { authenticate } from "../middleware/authMiddleware";
import {
  getWarehouses,
  createWarehouse,
  updateWarehouse,
  deleteWarehouse,
} from "../controllers/warehouseController";

const router = Router();

router.use(authenticate);

router.get("/", getWarehouses);
router.post("/", createWarehouse);
router.put("/:id", updateWarehouse);
router.delete("/:id", deleteWarehouse);

export default router;