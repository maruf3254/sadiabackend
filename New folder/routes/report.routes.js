
import { Router } from "express";
import {
  getProfitLossReport,
  getSalesReport,
  getPurchaseReport,
  getExpenseReport,
  getInventoryReport,
} from "../controllers/report.controller.js";
import {
  isLoggedIn,
  authorisedRoles,
} from "../middleware/auth.middleware.js";

const router = Router();

router.use(isLoggedIn, authorisedRoles("ADMIN"));

router.get("/profit-loss", getProfitLossReport);
router.get("/sales", getSalesReport);
router.get("/purchases", getPurchaseReport);
router.get("/expenses", getExpenseReport);
router.get("/inventory", getInventoryReport);

export default router;
