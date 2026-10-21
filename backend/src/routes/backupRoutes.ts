import { Router } from "express";
import { authenticate } from "../middleware/authMiddleware";
import {
  downloadBackup,
  getBackupStatus,
  syncToBackblaze,
} from "../controllers/backupController";

const router = Router();

router.use(authenticate);

router.get("/status", getBackupStatus);
router.get("/download", downloadBackup);
router.post("/b2-sync", syncToBackblaze);

export default router;
