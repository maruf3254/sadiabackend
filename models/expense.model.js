
import { Schema, model } from "mongoose";

const expenseSchema = new Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
    },
    category: {
      type: String,
      enum: [
        "RENT",
        "ELECTRICITY",
        "SALARY",
        "INTERNET",
        "TRANSPORT",
        "MAINTENANCE",
        "OTHER",
      ],
      default: "OTHER",
    },
    amount: {
      type: Number,
      required: true,
      min: 0.01,
    },
    expenseDate: {
      type: Date,
      default: Date.now,
    },
    description: {
      type: String,
      default: "",
    },
  },
  { timestamps: true }
);

export default model("Expense", expenseSchema);
