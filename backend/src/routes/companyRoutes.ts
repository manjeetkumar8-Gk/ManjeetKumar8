import { Router } from "express";
import {
  getCompanies,
  createCompany,
  updateCompany,
  deleteCompany,
} from "../controllers/companyController";
import { authenticate } from "../middleware/authMiddleware";

const router = Router();

router.use(authenticate);

router.get("/", getCompanies);
router.post("/", createCompany);
router.put("/:id", updateCompany);
router.delete("/:id", deleteCompany);

export default router;