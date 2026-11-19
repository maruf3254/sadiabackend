
import { Router } from "express";
import {
  createSale,
  getAllSales,
  getSingleSale,
  returnSaleItems,
} from "../controllers/sales.controller.js";
import {
  isLoggedIn,
  authorisedRoles,
} from "../middleware/auth.middleware.js";

const router = Router();

// router.use(isLoggedIn, authorisedRoles("ADMIN"));

router.post("/create", createSale);
router.get("/all", getAllSales);
router.get("/:id", getSingleSale);
router.post("/:id/return", returnSaleItems);

export default router;
