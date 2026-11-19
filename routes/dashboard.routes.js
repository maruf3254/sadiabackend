
import { Router } from "express";
import { getDashboardOverview } from "../controllers/dashboard.controller.js";
import {
  isLoggedIn,
  authorisedRoles,
} from "../middleware/auth.middleware.js";

const router = Router();

// router.use(isLoggedIn, authorisedRoles("ADMIN"));

router.get("/overview", getDashboardOverview);

export default router;
