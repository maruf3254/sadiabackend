
import { Router } from "express";
import {
  createPurchase,
  getAllPurchases,
  getSinglePurchase,
  cancelPurchase,
} from "../controllers/purchase.controller.js";
import {
  isLoggedIn,
  authorisedRoles,
} from "../middleware/auth.middleware.js";

const router = Router();

// router.use(isLoggedIn, authorisedRoles("ADMIN"));

router.use(isLoggedIn);

router.post("/create", createPurchase);
router.get("/all", getAllPurchases);
router.get("/:id", getSinglePurchase);
router.put("/:id/cancel", cancelPurchase);

export default router;
