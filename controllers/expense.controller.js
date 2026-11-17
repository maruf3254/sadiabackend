
import Expense from "../models/expense.model.js";
import AppError from "../utils/error.utils.js";
import { getPagination, getDateFilter } from "../utils/query.utils.js";

const categories = [
  "RENT",
  "ELECTRICITY",
  "SALARY",
  "INTERNET",
  "TRANSPORT",
  "MAINTENANCE",
  "OTHER",
];

// Create expense
export const createExpense = async (req, res, next) => {
  try {
    const { title, category, amount, expenseDate, description } = req.body;

    if (!title || amount === undefined) {
      return next(new AppError("Title and amount are required", 400));
    }

    const expenseAmount = Number(amount);

    if (!Number.isFinite(expenseAmount) || expenseAmount <= 0) {
      return next(new AppError("Invalid expense amount", 400));
    }

    if (category && !categories.includes(category)) {
      return next(new AppError("Invalid expense category", 400));
    }

    const expense = await Expense.create({
      title,
      category: category || "OTHER",
      amount: expenseAmount,
      expenseDate: expenseDate || new Date(),
      description: description || "",
    });

    res.status(201).json({
      success: true,
      message: "Expense recorded successfully",
      expense,
    });
  } catch (error) {
    next(error);
  }
};

// Get all expenses
export const getAllExpenses = async (req, res, next) => {
  try {
    const { page, limit, skip } = getPagination(req.query);

    const filter = {
      ...getDateFilter(req.query, "expenseDate"),
    };

    if (req.query.category) {
      if (!categories.includes(req.query.category)) {
        return next(new AppError("Invalid expense category", 400));
      }
      filter.category = req.query.category;
    }

    const [expenses, total] = await Promise.all([
      Expense.find(filter)
        .sort({ expenseDate: -1 })
        .skip(skip)
        .limit(limit),
      Expense.countDocuments(filter),
    ]);

    const totalAmount = await Expense.aggregate([
      { $match: filter },
      { $group: { _id: null, total: { $sum: "$amount" } } },
    ]);

    res.status(200).json({
      success: true,
      total,
      page,
      pages: Math.ceil(total / limit),
      totalExpense: totalAmount[0]?.total || 0,
      expenses,
    });
  } catch (error) {
    next(error);
  }
};

// Update expense
export const updateExpense = async (req, res, next) => {
  try {
    const allowedFields = [
      "title",
      "category",
      "amount",
      "expenseDate",
      "description",
    ];

    const updates = {};

    for (const field of allowedFields) {
      if (req.body[field] !== undefined) {
        updates[field] = req.body[field];
      }
    }

    if (
      updates.amount !== undefined &&
      (!Number.isFinite(Number(updates.amount)) ||
        Number(updates.amount) <= 0)
    ) {
      return next(new AppError("Invalid expense amount", 400));
    }

    if (updates.amount !== undefined) {
      updates.amount = Number(updates.amount);
    }

    if (
      updates.category !== undefined &&
      !categories.includes(updates.category)
    ) {
      return next(new AppError("Invalid expense category", 400));
    }

    const expense = await Expense.findByIdAndUpdate(
      req.params.id,
      { $set: updates },
      { new: true, runValidators: true }
    );

    if (!expense) {
      return next(new AppError("Expense not found", 404));
    }

    res.status(200).json({
      success: true,
      message: "Expense updated successfully",
      expense,
    });
  } catch (error) {
    next(error);
  }
};

// Delete expense
export const deleteExpense = async (req, res, next) => {
  try {
    const expense = await Expense.findByIdAndDelete(req.params.id);

    if (!expense) {
      return next(new AppError("Expense not found", 404));
    }

    res.status(200).json({
      success: true,
      message: "Expense deleted successfully",
    });
  } catch (error) {
    next(error);
  }
};
