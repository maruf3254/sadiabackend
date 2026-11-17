// import { configDotenv } from "dotenv";
// configDotenv();
// import cors from "cors";
// import cookieParser from "cookie-parser";
// import morgan from "morgan";
// import userRoutes from "./routes/user.routes.js";
// // import paymentRoutes from "./routes/payment.routes.js";
// import miscellaneousRoutes from "./routes/miscellaneous.routes.js";
// import express from "express";
// import connectToDb from "./config/db.config.js";
// import errorMiddleware from "./middleware/error.middleware.js";
// import mobileRoutes from "./routes/mobile.routes.js";

// const app = express();

// // middleware
// app.use(express.json());
// app.use(express.urlencoded({ extended: true }));
// app.use(cookieParser());
// app.use(morgan("dev"));
// // app.use(cors({ origin: [process.env.CLIENT_URL], credentials: true }));

// const corsOptions = {
//   origin: process.env.CLIENT_URL || "*", // Default to '*' if CORS_ORIGIN is not set
//   methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
//   allowedHeaders: ["Content-Type", "Authorization"],
//   credentials: true,
// };

// app.use(cors(corsOptions));

// app.use("/api/v1/user", userRoutes);
// app.use("/api/v1/mobile", mobileRoutes);
// // app.use("/api/v1/payments", paymentRoutes);
// app.use("/api/v1/", miscellaneousRoutes);

// app.all("*", (req, res) => {
//   res.status(404).send("OOPS!! 404 page not found");
// });

// app.use(errorMiddleware);

// // db init
// connectToDb();

// export default app;




import { configDotenv } from "dotenv";
configDotenv();

import cors from "cors";
import cookieParser from "cookie-parser";
import morgan from "morgan";
import express from "express";

import userRoutes from "./routes/user.routes.js";
import miscellaneousRoutes from "./routes/miscellaneous.routes.js";

import mobileRoutes from "./routes/mobile.routes.js";
import purchaseRoutes from "./routes/purchase.routes.js";
import salesRoutes from "./routes/sales.routes.js";
import expenseRoutes from "./routes/expense.routes.js";
import dashboardRoutes from "./routes/dashboard.routes.js";
import reportRoutes from "./routes/report.routes.js";

import connectToDb from "./config/db.config.js";
import errorMiddleware from "./middleware/error.middleware.js";

const app = express();

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(morgan("dev"));

const corsOptions = {
  origin: process.env.CLIENT_URL || "*",
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
  credentials: true,
};

app.use(cors(corsOptions));

// Routes
app.use("/api/v1/user", userRoutes);

app.use("/api/v1/mobile", mobileRoutes);
app.use("/api/v1/purchases", purchaseRoutes);
app.use("/api/v1/sales", salesRoutes);
app.use("/api/v1/expenses", expenseRoutes);
app.use("/api/v1/dashboard", dashboardRoutes);
app.use("/api/v1/reports", reportRoutes);

app.use("/api/v1", miscellaneousRoutes);

// 404
app.all("*", (req, res) => {
  res.status(404).json({
    success: false,
    message: "API route not found",
  });
});

// Error handler
app.use(errorMiddleware);

// Database
connectToDb();

export default app;
