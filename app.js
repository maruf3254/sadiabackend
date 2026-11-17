
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

const allowedOrigins = [
  "https://sadiamobile.vercel.app",
  "http://localhost:5173",
];

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.includes(origin)) {
        return callback(null, true);
      }
      return callback(new Error("Not allowed by CORS"));
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(morgan("dev"));

app.use("/api/v1/user", userRoutes);
app.use("/api/v1/mobile", mobileRoutes);
app.use("/api/v1/purchases", purchaseRoutes);
app.use("/api/v1/sales", salesRoutes);
app.use("/api/v1/expenses", expenseRoutes);
app.use("/api/v1/dashboard", dashboardRoutes);
app.use("/api/v1/reports", reportRoutes);
app.use("/api/v1", miscellaneousRoutes);

app.all("*", (req, res) => {
  res.status(404).json({
    success: false,
    message: "API route not found",
  });
});

app.use(errorMiddleware);

connectToDb();

export default app;
