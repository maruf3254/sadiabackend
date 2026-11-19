
import { Router } from "express";
import {
  createExpense,
  getAllExpenses,
  updateExpense,
  deleteExpense,
} from "../controllers/expense.controller.js";
import {
  isLoggedIn,
  authorisedRoles,
} from "../middleware/auth.middleware.js";

const router = Router();

router.use(isLoggedIn);

router.post("/create", createExpense);
router.get("/all", getAllExpenses);
router.put("/:id/update", updateExpense);
router.delete("/:id/delete", deleteExpense);

export default router;
