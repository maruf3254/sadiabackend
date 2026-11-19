
import { Router } from "express";
import {
  getAllMobiles,
  getSingleMobile,
  updateMobile,
  deleteMobile,
} from "../controllers/mobile.controller.js";
import {
  isLoggedIn,
  authorisedRoles,
} from "../middleware/auth.middleware.js";

const router = Router();

// router.use(isLoggedIn, authorisedRoles("ADMIN"));

router.get("/all", getAllMobiles);
router.get("/:id", getSingleMobile);
router.put("/:id/update", updateMobile);
router.delete("/:id/delete", deleteMobile);

export default router;
