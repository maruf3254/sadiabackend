
import Sale from "../models/sales.model.js";
import Purchase from "../models/purchase.model.js";
import Expense from "../models/expense.model.js";
import Mobile from "../models/mobile.model.js";
import { getDateFilter } from "../utils/query.utils.js";
import AppError from "../utils/error.utils.js";

// Profit and loss report
export const getProfitLossReport = async (req, res, next) => {
  try {
    const saleFilter = {
      ...getDateFilter(req.query, "saleDate"),
    };

    const expenseFilter = {
      ...getDateFilter(req.query, "expenseDate"),
    };

    const [sales, expenses] = await Promise.all([
      Sale.find(saleFilter).lean(),
      Expense.find(expenseFilter).lean(),
    ]);

    let totalSales = 0;
    let costOfGoodsSold = 0;
    let totalQuantity = 0;
    let returnedQuantity = 0;
    let refundedAmount = 0;

    for (const sale of sales) {
      const returnedImeis = new Set(
        sale.returnedItems.map((item) => item.imei)
      );

      returnedQuantity += sale.returnedItems.length;
      refundedAmount += sale.refundedAmount || 0;

      for (const item of sale.items) {
        if (!returnedImeis.has(item.imei)) {
          totalSales += item.netAmount;
          costOfGoodsSold += item.purchasePrice;
          totalQuantity++;
        }
      }
    }

    const totalExpenses = expenses.reduce(
      (sum, expense) => sum + expense.amount,
      0
    );

    const grossProfit = totalSales - costOfGoodsSold;
    const netProfit = grossProfit - totalExpenses;

    res.status(200).json({
      success: true,
      report: {
        totalInvoices: sales.length,
        totalQuantity,
        returnedQuantity,
        refundedAmount,
        totalSales,
        costOfGoodsSold,
        grossProfit,
        totalExpenses,
        netProfit,
        profitMargin:
          totalSales > 0
            ? Number(((netProfit / totalSales) * 100).toFixed(2))
            : 0,
      },
    });
  } catch (error) {
    next(error);
  }
};

// Sales report
export const getSalesReport = async (req, res, next) => {
  try {
    const filter = getDateFilter(req.query, "saleDate");

    const sales = await Sale.find(filter)
      .sort({ saleDate: -1 })
      .lean();

    const report = sales.map((sale) => {
      const returnedImeis = new Set(
        sale.returnedItems.map((item) => item.imei)
      );

      const validItems = sale.items.filter(
        (item) => !returnedImeis.has(item.imei)
      );

      const revenue = validItems.reduce(
        (sum, item) => sum + item.netAmount,
        0
      );

      const cost = validItems.reduce(
        (sum, item) => sum + item.purchasePrice,
        0
      );

      return {
        invoiceNumber: sale.invoiceNumber,
        saleDate: sale.saleDate,
        status: sale.status,
        totalQuantity: validItems.length,
        totalSales: revenue,
        cost,
        profit: revenue - cost,
        refundedAmount: sale.refundedAmount,
      };
    });

    res.status(200).json({
      success: true,
      total: report.length,
      totalSales: report.reduce((sum, item) => sum + item.totalSales, 0),
      totalProfit: report.reduce((sum, item) => sum + item.profit, 0),
      sales: report,
    });
  } catch (error) {
    next(error);
  }
};

// Purchase report
export const getPurchaseReport = async (req, res, next) => {
  try {
    const filter = {
      status: "COMPLETED",
      ...getDateFilter(req.query, "purchaseDate"),
    };

    const [purchases, summary] = await Promise.all([
      Purchase.find(filter).sort({ purchaseDate: -1 }),
      Purchase.aggregate([
        { $match: filter },
        {
          $group: {
            _id: null,
            totalAmount: { $sum: "$totalAmount" },
            totalQuantity: { $sum: "$totalQuantity" },
            totalInvoices: { $sum: 1 },
          },
        },
      ]),
    ]);

    res.status(200).json({
      success: true,
      summary: summary[0] || {
        totalAmount: 0,
        totalQuantity: 0,
        totalInvoices: 0,
      },
      purchases,
    });
  } catch (error) {
    next(error);
  }
};

// Expense report
export const getExpenseReport = async (req, res, next) => {
  try {
    const filter = getDateFilter(req.query, "expenseDate");

    const [expenses, summary] = await Promise.all([
      Expense.find(filter).sort({ expenseDate: -1 }),
      Expense.aggregate([
        { $match: filter },
        {
          $group: {
            _id: "$category",
            total: { $sum: "$amount" },
            count: { $sum: 1 },
          },
        },
        { $sort: { total: -1 } },
      ]),
    ]);

    const totalExpense = summary.reduce(
      (sum, item) => sum + item.total,
      0
    );

    res.status(200).json({
      success: true,
      totalExpense,
      categorySummary: summary,
      expenses,
    });
  } catch (error) {
    next(error);
  }
};

// Inventory report
export const getInventoryReport = async (req, res, next) => {
  try {
    const [summary, stock] = await Promise.all([
      Mobile.aggregate([
        { $match: { status: "IN_STOCK" } },
        {
          $group: {
            _id: null,
            totalPhones: { $sum: 1 },
            totalPurchaseValue: { $sum: "$purchasePrice" },
            totalSellingValue: { $sum: "$sellingPrice" },
          },
        },
      ]),

      Mobile.find({ status: "IN_STOCK" })
        .sort({ createdAt: -1 }),
    ]);

    res.status(200).json({
      success: true,
      summary: summary[0] || {
        totalPhones: 0,
        totalPurchaseValue: 0,
        totalSellingValue: 0,
      },
      stock,
    });
  } catch (error) {
    next(error);
  }
};
