
import { Schema, model } from "mongoose";

const saleItemSchema = new Schema(
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
    },
    sellingPrice: {
      type: Number,
      required: true,
    },
    discountAllocated: {
      type: Number,
      default: 0,
    },
    netAmount: {
      type: Number,
      required: true,
    },
  },
  { _id: false }
);

const returnedItemSchema = new Schema(
  {
    imei: {
      type: String,
      required: true,
    },
    refundAmount: {
      type: Number,
      required: true,
    },
    returnedAt: {
      type: Date,
      default: Date.now,
    },
    reason: {
      type: String,
      default: "",
    },
  },
  { _id: false }
);

const saleSchema = new Schema(
  {
    invoiceNumber: {
      type: String,
      required: true,
      unique: true,
    },
    items: {
      type: [saleItemSchema],
      required: true,
    },
    returnedItems: {
      type: [returnedItemSchema],
      default: [],
    },
    totalQuantity: {
      type: Number,
      required: true,
    },
    subtotal: {
      type: Number,
      required: true,
    },
    discount: {
      type: Number,
      default: 0,
    },
    totalAmount: {
      type: Number,
      required: true,
    },
    refundedAmount: {
      type: Number,
      default: 0,
    },
    saleDate: {
      type: Date,
      default: Date.now,
    },
    notes: {
      type: String,
      default: "",
    },
    status: {
      type: String,
      enum: ["COMPLETED", "PARTIALLY_RETURNED", "RETURNED"],
      default: "COMPLETED",
    },
  },
  { timestamps: true }
);

export default model("Sale", saleSchema);
