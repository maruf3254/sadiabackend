
import { Schema, model } from "mongoose";

const purchaseItemSchema = new Schema(
  {
    mobile: {
      type: Schema.Types.ObjectId,
      ref: "Mobile",
      required: true,
    },
    imei: {
      type: String,
      required: true,
    },
    brand: String,
    model: String,
    purchasePrice: {
      type: Number,
      required: true,
      min: 0,
    },
  },
  { _id: false }
);

const purchaseSchema = new Schema(
  {
    invoiceNumber: {
      type: String,
      required: true,
      unique: true,
    },
    items: {
      type: [purchaseItemSchema],
      required: true,
    },
    totalQuantity: {
      type: Number,
      required: true,
    },
    totalAmount: {
      type: Number,
      required: true,
      min: 0,
    },
    purchaseDate: {
      type: Date,
      default: Date.now,
    },
    notes: {
      type: String,
      default: "",
    },
    status: {
      type: String,
      enum: ["COMPLETED", "CANCELLED"],
      default: "COMPLETED",
    },
  },
  { timestamps: true }
);

export default model("Purchase", purchaseSchema);
