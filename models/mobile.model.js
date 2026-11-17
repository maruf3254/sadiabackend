
import { Schema, model } from "mongoose";

const mobileSchema = new Schema(
  {
    brand: {
      type: String,
      required: true,
      trim: true,
    },
    model: {
      type: String,
      required: true,
      trim: true,
    },
    imei: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      index: true,
    },
    imei2: {
      type: String,
      trim: true,
      default: null,
    },
    color: {
      type: String,
      trim: true,
      default: "",
    },
    ram: {
      type: String,
      default: "",
    },
    storage: {
      type: String,
      default: "",
    },
    purchasePrice: {
      type: Number,
      required: true,
      min: 0,
    },
    sellingPrice: {
      type: Number,
      required: true,
      min: 0,
    },
    status: {
      type: String,
      enum: ["IN_STOCK", "SOLD"],
      default: "IN_STOCK",
      index: true,
    },
    purchase: {
      type: Schema.Types.ObjectId,
      ref: "Purchase",
      default: null,
    },
    sale: {
      type: Schema.Types.ObjectId,
      ref: "Sale",
      default: null,
    },
    warrantyMonths: {
      type: Number,
      default: 0,
      min: 0,
    },
    notes: {
      type: String,
      default: "",
    },
  },
  { timestamps: true }
);

mobileSchema.index({ brand: 1, model: 1, status: 1 });

export default model("Mobile", mobileSchema);
