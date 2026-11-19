
import mongoose from "mongoose";
import Purchase from "../models/purchase.model.js";
import Mobile from "../models/mobile.model.js";
import AppError from "../utils/error.utils.js";
import generateInvoice from "../utils/invoice.utils.js";
import { getPagination, getDateFilter } from "../utils/query.utils.js";

// Create purchase
export const createPurchase = async (req, res, next) => {
  const session = await mongoose.startSession();

  try {
    const { items, purchaseDate, notes } = req.body;

    if (!Array.isArray(items) || items.length === 0) {
      return next(new AppError("Purchase items are required", 400));
    }

    const imeis = items.map((item) => String(item.imei || "").trim());

    if (imeis.some((imei) => !imei)) {
      return next(new AppError("Every phone needs an IMEI", 400));
    }

    if (new Set(imeis).size !== imeis.length) {
      return next(new AppError("Duplicate IMEI in purchase", 400));
    }

    let purchase;

    await session.withTransaction(async () => {
      const phoneDocuments = items.map((item) => {
        const purchasePrice = Number(item.purchasePrice);
        const sellingPrice = Number(item.sellingPrice);

        if (
          !item.brand ||
          !item.model ||
          !Number.isFinite(purchasePrice) ||
          purchasePrice < 0 ||
          !Number.isFinite(sellingPrice) ||
          sellingPrice < 0
        ) {
          throw new AppError("Invalid phone purchase information", 400);
        }

        return {
          brand: item.brand,
          model: item.model,
          imei: String(item.imei).trim(),
          imei2: item.imei2 || null,
          color: item.color || "",
          ram: item.ram || "",
          storage: item.storage || "",
          purchasePrice,
          sellingPrice,
          warrantyMonths: Number(item.warrantyMonths || 0),
          notes: item.notes || "",
          status: "IN_STOCK",
        };
      });

      const createdMobiles = await Mobile.insertMany(phoneDocuments, {
        session,
      });

      const totalAmount = phoneDocuments.reduce(
        (sum, item) => sum + item.purchasePrice,
        0
      );

      const [createdPurchase] = await Purchase.create(
        [
          {
            invoiceNumber: generateInvoice("PUR"),
            items: createdMobiles.map((mobile) => ({
              mobile: mobile._id,
              imei: mobile.imei,
              brand: mobile.brand,
              model: mobile.model,
              purchasePrice: mobile.purchasePrice,
            })),
            totalQuantity: createdMobiles.length,
            totalAmount,
            purchaseDate: purchaseDate || new Date(),
            notes: notes || "",
          },
        ],
        { session }
      );

      await Mobile.updateMany(
        { _id: { $in: createdMobiles.map((item) => item._id) } },
        { $set: { purchase: createdPurchase._id } },
        { session }
      );

      purchase = createdPurchase;
    });

    res.status(201).json({
      success: true,
      message: "Purchase created successfully",
      purchase,
    });
  } catch (error) {
    next(error);
  } finally {
    await session.endSession();
  }
};

// Get all purchases
export const getAllPurchases = async (req, res, next) => {
  try {
    const { page, limit, skip } = getPagination(req.query);

    const filter = {
      status: "COMPLETED",
      ...getDateFilter(req.query, "purchaseDate"),
    };

    const [purchases, total] = await Promise.all([
      Purchase.find(filter)
        .sort({ purchaseDate: -1 })
        .skip(skip)
        .limit(limit),
      Purchase.countDocuments(filter),
    ]);

    res.status(200).json({
      success: true,
      total,
      page,
      pages: Math.ceil(total / limit),
      purchases,
    });
  } catch (error) {
    next(error);
  }
};

// Get purchase details
export const getSinglePurchase = async (req, res, next) => {
  try {
    const purchase = await Purchase.findById(req.params.id)
      .populate("items.mobile");

    if (!purchase) {
      return next(new AppError("Purchase not found", 404));
    }

    res.status(200).json({ success: true, purchase });
  } catch (error) {
    next(error);
  }
};

// Cancel purchase - only if none of its phones have been sold
export const cancelPurchase = async (req, res, next) => {
  const session = await mongoose.startSession();

  try {
    let cancelled = false;

    await session.withTransaction(async () => {
      const purchase = await Purchase.findById(req.params.id).session(session);

      if (!purchase) {
        throw new AppError("Purchase not found", 404);
      }

      if (purchase.status === "CANCELLED") {
        throw new AppError("Purchase already cancelled", 400);
      }

      const mobileIds = purchase.items.map((item) => item.mobile);

      const soldCount = await Mobile.countDocuments({
        _id: { $in: mobileIds },
        status: "SOLD",
      }).session(session);

      if (soldCount > 0) {
        throw new AppError(
          "Cannot cancel purchase because one or more phones have been sold",
          400
        );
      }

      await Mobile.deleteMany(
        { _id: { $in: mobileIds }, status: "IN_STOCK" },
        { session }
      );

      purchase.status = "CANCELLED";
      await purchase.save({ session });

      cancelled = true;
    });

    res.status(200).json({
      success: cancelled,
      message: "Purchase cancelled successfully",
    });
  } catch (error) {
    next(error);
  } finally {
    await session.endSession();
  }
};
