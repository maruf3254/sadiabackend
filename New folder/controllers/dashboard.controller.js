
import Mobile from "../models/mobile.model.js";
import Sale from "../models/sales.model.js";
import Purchase from "../models/purchase.model.js";
import Expense from "../models/expense.model.js";

const getPeriod = (start, end) => ({
  $gte: start,
  $lte: end,
});

const calculateSales = async (filter = {}) => {
  const sales = await Sale.find(filter).lean();

  let revenue = 0;
  let cost = 0;
  let quantity = 0;
  let refunded = 0;

  for (const sale of sales) {
    const returnedImeis = new Set(
      sale.returnedItems.map((item) => item.imei)
    );

    for (const item of sale.items) {
      if (!returnedImeis.has(item.imei)) {
        revenue += item.netAmount;
        cost += item.purchasePrice;
        quantity++;
      }
    }

    refunded += sale.refundedAmount || 0;
  }

  return {
    revenue,
    cost,
    grossProfit: revenue - cost,
    quantity,
    refunded,
    invoices: sales.length,
  };
};

export const getDashboardOverview = async (req, res, next) => {
  try {
    const now = new Date();

    const todayStart = new Date(now);
    todayStart.setHours(0, 0, 0, 0);

    const todayEnd = new Date(now);
    todayEnd.setHours(23, 59, 59, 999);

    const monthStart = new Date(
      now.getFullYear(),
      now.getMonth(),
      1
    );

    const monthEnd = new Date(
      now.getFullYear(),
      now.getMonth() + 1,
      0,
      23,
      59,
      59,
      999
    );

    const [
      totalMobiles,
      availableMobiles,
      soldMobiles,
      inventoryValue,
      todaySales,
      monthlySales,
      todayExpenses,
      monthlyExpenses,
      todayPurchases,
      monthlyPurchases,
      recentSales,
      lowStock,
    ] = await Promise.all([
      Mobile.countDocuments(),
      Mobile.countDocuments({ status: "IN_STOCK" }),
      Mobile.countDocuments({ status: "SOLD" }),

      Mobile.aggregate([
        { $match: { status: "IN_STOCK" } },
        {
          $group: {
            _id: null,
            purchaseValue: { $sum: "$purchasePrice" },
            potentialSellingValue: { $sum: "$sellingPrice" },
          },
        },
      ]),

      calculateSales({
        saleDate: getPeriod(todayStart, todayEnd),
      }),

      calculateSales({
        saleDate: getPeriod(monthStart, monthEnd),
      }),

      Expense.aggregate([
        {
          $match: {
            expenseDate: getPeriod(todayStart, todayEnd),
          },
        },
        { $group: { _id: null, total: { $sum: "$amount" } } },
      ]),

      Expense.aggregate([
        {
          $match: {
            expenseDate: getPeriod(monthStart, monthEnd),
          },
        },
        { $group: { _id: null, total: { $sum: "$amount" } } },
      ]),

      Purchase.aggregate([
        {
          $match: {
            status: "COMPLETED",
            purchaseDate: getPeriod(todayStart, todayEnd),
          },
        },
        { $group: { _id: null, total: { $sum: "$totalAmount" } } },
      ]),

      Purchase.aggregate([
        {
          $match: {
            status: "COMPLETED",
            purchaseDate: getPeriod(monthStart, monthEnd),
          },
        },
        { $group: { _id: null, total: { $sum: "$totalAmount" } } },
      ]),

      Sale.find().sort({ saleDate: -1 }).limit(5),

      Mobile.aggregate([
        { $match: { status: "IN_STOCK" } },
        {
          $group: {
            _id: { brand: "$brand", model: "$model" },
            quantity: { $sum: 1 },
          },
        },
        { $sort: { quantity: 1 } },
        { $limit: 5 },
      ]),
    ]);

    const todayExpense = todayExpenses[0]?.total || 0;
    const monthlyExpense = monthlyExpenses[0]?.total || 0;

    const todayGrossProfit = todaySales.grossProfit;
    const monthlyGrossProfit = monthlySales.grossProfit;

    res.status(200).json({
      success: true,

      inventory: {
        totalMobiles,
        availableMobiles,
        soldMobiles,
        purchaseValue: inventoryValue[0]?.purchaseValue || 0,
        potentialSellingValue:
          inventoryValue[0]?.potentialSellingValue || 0,
      },

      today: {
        ...todaySales,
        expenses: todayExpense,
        netProfit: todayGrossProfit - todayExpense,
        purchases: todayPurchases[0]?.total || 0,
      },

      monthly: {
        ...monthlySales,
        expenses: monthlyExpense,
        netProfit: monthlyGrossProfit - monthlyExpense,
        purchases: monthlyPurchases[0]?.total || 0,
      },

      recentSales,
      lowStock,
    });
  } catch (error) {
    next(error);
  }
};
