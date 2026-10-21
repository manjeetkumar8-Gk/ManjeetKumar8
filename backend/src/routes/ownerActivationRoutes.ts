import { Router } from "express";
import { activateOwner } from "../controllers/ownerActivationController";

const router = Router();

router.post("/activate", activateOwner);

export default router;