
import { Router } from "express";
import {
  getVehicles,
  createVehicle,
  updateVehicle,
  deleteVehicle,
} from "../controllers/vehicleController";
import { authenticate } from "../middleware/authMiddleware";

const router = Router();

router.use(authenticate);

router.get("/", getVehicles);
router.post("/", createVehicle);
router.put("/:id", updateVehicle);
router.delete("/:id", deleteVehicle);

export default router;

