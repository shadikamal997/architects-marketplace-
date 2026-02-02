import express from "express";
import {
  createModificationRequest,
  priceModification,
  acceptModification,
  completeModification
} from "../controllers/modificationController";
import { authenticateToken } from "../middleware";

const router = express.Router();

router.post("/", authenticateToken, createModificationRequest);
router.post("/:id/price", authenticateToken, priceModification);
router.post("/:id/accept", authenticateToken, acceptModification);
router.post("/:id/complete", authenticateToken, completeModification);

export default router;