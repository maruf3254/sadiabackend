
import Mobile from "../models/mobile.model.js";
import Sale from "../models/sales.model.js";
import Purchase from "../models/purchase.model.js";
import Expense from "../models/expense.model.js";

const TIME_ZONE = "Asia/Dhaka";
const BD_OFFSET = 6 * 60 * 60 * 1000;

const getPeriod = (start, end) => ({
  $gte: start,
  $lte: end,
});

// Bangladesh date parts
const getDhakaDateParts = (date = new Date()) => {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: TIME_ZONE,
    year: "numeric",
    month: "numeric",
    day: "numeric",
  }).formatToParts(date);

  const result = {};

  for (const part of parts) {
    if (part.type !== "literal") {
      result[part.type] = Number(part.value);
    }
  }

  return {
    year: result.year,
    month: result.month,
    day: result.day,
  };
};

// Convert Bangladesh local date to UTC
const dhakaDateToUTC = (
  year,
  month,
  day,
  hour = 0,
  minute = 0,
  second = 0,
  millisecond = 0
) => {
  return new Date(
    Date.UTC(
      year,
      month - 1,
      day,
      hour,
      minute,
      second,
      millisecond
    ) - BD_OFFSET
  );
};

// Get current Bangladesh date periods
const getBangladeshPeriods = () => {
  const now = new Date();
  const { year, month, day } = getDhakaDateParts(now);

  const todayStart = dhakaDateToUTC(year, month, day);

  const todayEnd = new Date(
    dhakaDateToUTC(year, month, day + 1).getTime() - 1
  );

  const monthStart = dhakaDateToUTC(year, month, 1);

  const monthEnd = new Date(
    dhakaDateToUTC(year, month + 1, 1).getTime() - 1
  );

  const yearStart = dhakaDateToUTC(year, 1, 1);

  const daysInMonth = new Date(year, month, 0).getDate();

  return {
    now,
    year,
    month,
    day,
    todayStart,
    todayEnd,
    monthStart,
    monthEnd,
    yearStart,
    daysInMonth,
  };
};

// Calculate sales
const calculateSales = async (filter = {}) => {
  const sales = await Sale.find(filter).lean();

  let revenue = 0;
  let cost = 0;
  let quantity = 0;
  let refunded = 0;

  for (const sale of sales) {
    const returnedImeis = new Set(
      (sale.returnedItems || []).map((item) => item.imei)
    );

    for (const item of sale.items || []) {
      if (!returnedImeis.has(item.imei)) {
        revenue += Number(item.netAmount || 0);
        cost += Number(item.purchasePrice || 0);
        quantity++;
      }
    }

    refunded += Number(sale.refundedAmount || 0);
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

// Build current year monthly chart
const buildYearlyChart = (sales, expenses, year) => {
  const months = Array.from({ length: 12 }, (_, index) => ({
    month: index,
    label: new Date(year, index, 1).toLocaleString("en-US", {
      month: "short",
    }),
    revenue: 0,
    cost: 0,
    grossProfit: 0,
    expenses: 0,
    netProfit: 0,
  }));

  // Sales
  for (const sale of sales) {
    const monthIndex = new Date(sale.saleDate).getMonth();

    if (monthIndex < 0 || monthIndex > 11) continue;

    const returnedImeis = new Set(
      (sale.returnedItems || []).map((item) => item.imei)
    );

    for (const item of sale.items || []) {
      if (!returnedImeis.has(item.imei)) {
        months[monthIndex].revenue += Number(item.netAmount || 0);
        months[monthIndex].cost += Number(item.purchasePrice || 0);
      }
    }
  }

  // Expenses
  for (const expense of expenses) {
    const monthIndex = new Date(expense.expenseDate).getMonth();

    if (monthIndex >= 0 && monthIndex <= 11) {
      months[monthIndex].expenses += Number(expense.amount || 0);
    }
  }

  // Profit
  for (const month of months) {
    month.grossProfit = month.revenue - month.cost;
    month.netProfit = month.grossProfit - month.expenses;
  }

  return months;
};

// Build current month pie chart
const buildMonthlyPie = (monthlySales, monthlyExpense) => {
  const grossProfit = monthlySales.grossProfit || 0;
  const netProfit = grossProfit - monthlyExpense;

  return {
    data: [
      {
        name: "Cost",
        value: monthlySales.cost || 0,
      },
      {
        name: "Expenses",
        value: monthlyExpense || 0,
      },
      {
        name: "Net Profit",
        value: Math.max(0, netProfit),
      },
    ],
    netLoss: Math.max(0, -netProfit),
    revenue: monthlySales.revenue || 0,
  };
};

export const getDashboardOverview = async (req, res, next) => {
  try {
    const {
      now,
      year,
      todayStart,
      todayEnd,
      monthStart,
      monthEnd,
      yearStart,
    } = getBangladeshPeriods();

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

      yearlySales,
      yearlyExpenses,
    ] = await Promise.all([
      // Inventory
      Mobile.countDocuments(),

      Mobile.countDocuments({
        status: "IN_STOCK",
      }),

      Mobile.countDocuments({
        status: "SOLD",
      }),

      Mobile.aggregate([
        {
          $match: {
            status: "IN_STOCK",
          },
        },
        {
          $group: {
            _id: null,
            purchaseValue: {
              $sum: "$purchasePrice",
            },
            potentialSellingValue: {
              $sum: "$sellingPrice",
            },
          },
        },
      ]),

      // Today's sales
      calculateSales({
        saleDate: getPeriod(todayStart, todayEnd),
      }),

      // Monthly sales
      calculateSales({
        saleDate: getPeriod(monthStart, monthEnd),
      }),

      // Today's expenses
      Expense.aggregate([
        {
          $match: {
            expenseDate: getPeriod(todayStart, todayEnd),
          },
        },
        {
          $group: {
            _id: null,
            total: {
              $sum: "$amount",
            },
          },
        },
      ]),

      // Monthly expenses
      Expense.aggregate([
        {
          $match: {
            expenseDate: getPeriod(monthStart, monthEnd),
          },
        },
        {
          $group: {
            _id: null,
            total: {
              $sum: "$amount",
            },
          },
        },
      ]),

      // Today's purchases
      Purchase.aggregate([
        {
          $match: {
            status: "COMPLETED",
            purchaseDate: getPeriod(todayStart, todayEnd),
          },
        },
        {
          $group: {
            _id: null,
            total: {
              $sum: "$totalAmount",
            },
          },
        },
      ]),

      // Monthly purchases
      Purchase.aggregate([
        {
          $match: {
            status: "COMPLETED",
            purchaseDate: getPeriod(monthStart, monthEnd),
          },
        },
        {
          $group: {
            _id: null,
            total: {
              $sum: "$totalAmount",
            },
          },
        },
      ]),

      // Recent sales
      Sale.find()
        .sort({ saleDate: -1 })
        .limit(5)
        .lean(),

      // Low stock
      Mobile.aggregate([
        {
          $match: {
            status: "IN_STOCK",
          },
        },
        {
          $group: {
            _id: {
              brand: "$brand",
              model: "$model",
            },
            quantity: {
              $sum: 1,
            },
          },
        },
        {
          $sort: {
            quantity: 1,
          },
        },
        {
          $limit: 5,
        },
      ]),

      // Current year's sales
      Sale.find({
        saleDate: getPeriod(yearStart, now),
      }).lean(),

      // Current year's expenses
      Expense.find({
        expenseDate: getPeriod(yearStart, now),
      }).lean(),
    ]);

    // Expense totals
    const todayExpense = todayExpenses[0]?.total || 0;
    const monthlyExpense = monthlyExpenses[0]?.total || 0;

    // Profit
    const todayNetProfit =
      todaySales.grossProfit - todayExpense;

    const monthlyNetProfit =
      monthlySales.grossProfit - monthlyExpense;

    // Yearly chart
    const yearlyChart = buildYearlyChart(
      yearlySales,
      yearlyExpenses,
      year
    );

    // Monthly pie chart
    const monthlyPie = buildMonthlyPie(
      monthlySales,
      monthlyExpense
    );

    // Response
    res.status(200).json({
      success: true,

      inventory: {
        totalMobiles,
        availableMobiles,
        soldMobiles,

        purchaseValue:
          inventoryValue[0]?.purchaseValue || 0,

        potentialSellingValue:
          inventoryValue[0]?.potentialSellingValue || 0,
      },

      today: {
        ...todaySales,
        expenses: todayExpense,
        netProfit: todayNetProfit,
        purchases: todayPurchases[0]?.total || 0,
      },

      monthly: {
        ...monthlySales,
        expenses: monthlyExpense,
        netProfit: monthlyNetProfit,
        purchases: monthlyPurchases[0]?.total || 0,
      },

      charts: {
        monthlyPie,
        yearlyChart,
      },

      recentSales,
      lowStock,
    });
  } catch (error) {
    next(error);
  }
};
