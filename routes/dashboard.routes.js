import { Router } from "express";
import { getDashboardOverview } from "../controllers/dashboard.controller.js";
import { isLoggedIn } from "../middleware/auth.middleware.js";

const router = Router();

router.use(isLoggedIn);

router.get("/overview", getDashboardOverview);

export default router;