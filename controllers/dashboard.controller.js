
import Mobile from "../models/mobile.model.js";
import Sale from "../models/sales.model.js";
import Purchase from "../models/purchase.model.js";
import Expense from "../models/expense.model.js";

// Bangladesh timezone
const TIME_ZONE = "Asia/Dhaka";

// Get start and end of a period
const getPeriod = (start, end) => ({
  $gte: start,
  $lte: end,
});

// Get current date parts in Bangladesh timezone
const getDhakaDateParts = (date = new Date()) => {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);

  const values = {};

  parts.forEach((part) => {
    if (part.type !== "literal") {
      values[part.type] = Number(part.value);
    }
  });

  return values;
};

// Convert Bangladesh local date/time into UTC Date
const dhakaDateToUTC = (year, month, day, hour = 0, minute = 0, second = 0, ms = 0) => {
  const utcValue = Date.UTC(
    year,
    month - 1,
    day,
    hour,
    minute,
    second,
    ms
  );

  // Bangladesh is UTC+6
  return new Date(utcValue - 6 * 60 * 60 * 1000);
};

// Get current Bangladesh date boundaries
const getBangladeshPeriods = () => {
  const now = new Date();
  const { year, month, day } = getDhakaDateParts(now);

  const todayStart = dhakaDateToUTC(year, month, day);
  const todayEnd = dhakaDateToUTC(year, month, day + 1, 0, 0, 0, 0);
  todayEnd.setMilliseconds(todayEnd.getMilliseconds() - 1);

  const monthStart = dhakaDateToUTC(year, month, 1);

  const nextMonthStart = month === 12
    ? dhakaDateToUTC(year + 1, 1, 1)
    : dhakaDateToUTC(year, month + 1, 1);

  const monthEnd = new Date(nextMonthStart.getTime() - 1);

  const daysInMonth = new Date(year, month, 0).getDate();

  return {
    now,
    year,
    month,
    todayStart,
    todayEnd,
    monthStart,
    monthEnd,
    daysInMonth,
  };
};

// Get Bangladesh hour
const getDhakaHour = (date) => {
  return Number(
    new Intl.DateTimeFormat("en-US", {
      timeZone: TIME_ZONE,
      hour: "2-digit",
      hourCycle: "h23",
    }).format(date)
  );
};

// Get Bangladesh day of month
const getDhakaDay = (date) => {
  return Number(
    new Intl.DateTimeFormat("en-US", {
      timeZone: TIME_ZONE,
      day: "2-digit",
    }).format(date)
  );
};

// Calculate actual sales after returned items
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
        revenue += item.netAmount || 0;
        cost += item.purchasePrice || 0;
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

// Calculate chart sales metrics
const calculateChartSales = (sales) => {
  let revenue = 0;
  let cost = 0;

  for (const sale of sales) {
    const returnedImeis = new Set(
      (sale.returnedItems || []).map((item) => item.imei)
    );

    for (const item of sale.items || []) {
      if (!returnedImeis.has(item.imei)) {
        revenue += item.netAmount || 0;
        cost += item.purchasePrice || 0;
      }
    }
  }

  return {
    revenue,
    grossProfit: revenue - cost,
  };
};

// Build daily and monthly chart data
const buildChartData = (sales, expenses, type, daysInMonth = 31) => {
  const count = type === "hour" ? 24 : daysInMonth;

  const chart = Array.from({ length: count }, (_, index) => ({
    label:
      type === "hour"
        ? `${String(index).padStart(2, "0")}:00`
        : String(index + 1),

    revenue: 0,
    grossProfit: 0,
    expenses: 0,
    netProfit: 0,
  }));

  // Process sales
  for (const sale of sales) {
    const date = new Date(sale.saleDate);

    const index =
      type === "hour"
        ? getDhakaHour(date)
        : getDhakaDay(date) - 1;

    if (index < 0 || index >= count) continue;

    const metrics = calculateChartSales([sale]);

    chart[index].revenue += metrics.revenue;
    chart[index].grossProfit += metrics.grossProfit;
  }

  // Process expenses
  for (const expense of expenses) {
    const date = new Date(expense.expenseDate);

    const index =
      type === "hour"
        ? getDhakaHour(date)
        : getDhakaDay(date) - 1;

    if (index < 0 || index >= count) continue;

    chart[index].expenses += expense.amount || 0;
  }

  // Calculate net profit
  for (const item of chart) {
    item.netProfit = item.grossProfit - item.expenses;
  }

  return chart;
};

// Dashboard Overview Controller
export const getDashboardOverview = async (req, res, next) => {
  try {
    const {
      todayStart,
      todayEnd,
      monthStart,
      monthEnd,
      daysInMonth,
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

      dailyChartSales,
      dailyChartExpenses,

      monthlyChartSales,
      monthlyChartExpenses,
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

      // Lowest stock models
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

      // Daily chart sales
      Sale.find({
        saleDate: getPeriod(todayStart, todayEnd),
      }).lean(),

      // Daily chart expenses
      Expense.find({
        expenseDate: getPeriod(todayStart, todayEnd),
      }).lean(),

      // Monthly chart sales
      Sale.find({
        saleDate: getPeriod(monthStart, monthEnd),
      }).lean(),

      // Monthly chart expenses
      Expense.find({
        expenseDate: getPeriod(monthStart, monthEnd),
      }).lean(),
    ]);

    // Expenses
    const todayExpense = todayExpenses[0]?.total || 0;
    const monthlyExpense = monthlyExpenses[0]?.total || 0;

    // Profit
    const todayGrossProfit = todaySales.grossProfit;
    const monthlyGrossProfit = monthlySales.grossProfit;

    // Charts
    const dailyChart = buildChartData(
      dailyChartSales,
      dailyChartExpenses,
      "hour"
    );

    const monthlyChart = buildChartData(
      monthlyChartSales,
      monthlyChartExpenses,
      "day",
      daysInMonth
    );

    // Response
    res.status(200).json({
      success: true,

      // Inventory
      inventory: {
        totalMobiles,
        availableMobiles,
        soldMobiles,

        purchaseValue:
          inventoryValue[0]?.purchaseValue || 0,

        potentialSellingValue:
          inventoryValue[0]?.potentialSellingValue || 0,
      },

      // Today's business
      today: {
        ...todaySales,

        expenses: todayExpense,

        netProfit:
          todayGrossProfit - todayExpense,

        purchases:
          todayPurchases[0]?.total || 0,
      },

      // Monthly business
      monthly: {
        ...monthlySales,

        expenses: monthlyExpense,

        netProfit:
          monthlyGrossProfit - monthlyExpense,

        purchases:
          monthlyPurchases[0]?.total || 0,
      },

      // Daily hourly chart
      dailyChart,

      // Monthly daily chart
      monthlyChart,

      // Recent sales
      recentSales,

      // Low stock
      lowStock,
    });
  } catch (error) {
    next(error);
  }
};
