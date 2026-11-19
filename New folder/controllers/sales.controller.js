
import mongoose from "mongoose";
import Mobile from "../models/mobile.model.js";
import Sale from "../models/sales.model.js";
import AppError from "../utils/error.utils.js";
import generateInvoice from "../utils/invoice.utils.js";
import { getPagination, getDateFilter } from "../utils/query.utils.js";

// Create sale
export const createSale = async (req, res, next) => {
  const session = await mongoose.startSession();

  try {
    const { items, discount = 0, saleDate, notes } = req.body;

    if (!Array.isArray(items) || items.length === 0) {
      return next(new AppError("Sale items are required", 400));
    }

    const mobileIds = items.map((item) => item.mobile);

    if (
      mobileIds.some((id) => !mongoose.isValidObjectId(id)) ||
      new Set(mobileIds.map(String)).size !== mobileIds.length
    ) {
      return next(new AppError("Invalid or duplicate mobile IDs", 400));
    }

    const discountAmount = Number(discount);

    if (!Number.isFinite(discountAmount) || discountAmount < 0) {
      return next(new AppError("Invalid discount", 400));
    }

    let sale;

    await session.withTransaction(async () => {
      const mobiles = await Mobile.find({
        _id: { $in: mobileIds },
        status: "IN_STOCK",
      }).session(session);

      if (mobiles.length !== mobileIds.length) {
        throw new AppError(
          "One or more phones are unavailable or already sold",
          400
        );
      }

      const mobileMap = new Map(
        mobiles.map((mobile) => [String(mobile._id), mobile])
      );

      const subtotal = mobiles.reduce(
        (sum, mobile) => sum + mobile.sellingPrice,
        0
      );

      if (discountAmount > subtotal) {
        throw new AppError("Discount cannot exceed subtotal", 400);
      }

      // Allocate discount proportionally to each phone.
      let allocatedDiscount = 0;

      const saleItems = mobiles.map((mobile, index) => {
        let itemDiscount;

        if (index === mobiles.length - 1) {
          itemDiscount = Number(
            (discountAmount - allocatedDiscount).toFixed(2)
          );
        } else {
          itemDiscount = Number(
            ((discountAmount * mobile.sellingPrice) / subtotal).toFixed(2)
          );
          allocatedDiscount += itemDiscount;
        }

        return {
          mobile: mobile._id,
          imei: mobile.imei,
          brand: mobile.brand,
          model: mobile.model,
          purchasePrice: mobile.purchasePrice,
          sellingPrice: mobile.sellingPrice,
          discountAllocated: itemDiscount,
          netAmount: Number(
            (mobile.sellingPrice - itemDiscount).toFixed(2)
          ),
        };
      });

      const totalAmount = Number(
        (subtotal - discountAmount).toFixed(2)
      );

      const [createdSale] = await Sale.create(
        [
          {
            invoiceNumber: generateInvoice("SAL"),
            items: saleItems,
            totalQuantity: mobiles.length,
            subtotal,
            discount: discountAmount,
            totalAmount,
            saleDate: saleDate || new Date(),
            notes: notes || "",
          },
        ],
        { session }
      );

      const updateResult = await Mobile.updateMany(
        {
          _id: { $in: mobileIds },
          status: "IN_STOCK",
        },
        {
          $set: {
            status: "SOLD",
            sale: createdSale._id,
          },
        },
        { session }
      );

      if (updateResult.modifiedCount !== mobiles.length) {
        throw new AppError("Stock changed. Please try again.", 409);
      }

      sale = createdSale;
    });

    res.status(201).json({
      success: true,
      message: "Sale completed successfully",
      sale,
    });
  } catch (error) {
    next(error);
  } finally {
    await session.endSession();
  }
};

// Get all sales
export const getAllSales = async (req, res, next) => {
  try {
    const { page, limit, skip } = getPagination(req.query);

    const filter = {
      ...getDateFilter(req.query, "saleDate"),
    };

    if (req.query.status) {
      if (
        !["COMPLETED", "PARTIALLY_RETURNED", "RETURNED"].includes(
          req.query.status
        )
      ) {
        return next(new AppError("Invalid sale status", 400));
      }
      filter.status = req.query.status;
    }

    const [sales, total] = await Promise.all([
      Sale.find(filter)
        .sort({ saleDate: -1 })
        .skip(skip)
        .limit(limit),
      Sale.countDocuments(filter),
    ]);

    res.status(200).json({
      success: true,
      total,
      page,
      pages: Math.ceil(total / limit),
      sales,
    });
  } catch (error) {
    next(error);
  }
};

// Get one sale
export const getSingleSale = async (req, res, next) => {
  try {
    const sale = await Sale.findById(req.params.id)
      .populate("items.mobile");

    if (!sale) {
      return next(new AppError("Sale not found", 404));
    }

    res.status(200).json({
      success: true,
      sale,
    });
  } catch (error) {
    next(error);
  }
};

// Return one or multiple phones from a sale
export const returnSaleItems = async (req, res, next) => {
  const session = await mongoose.startSession();

  try {
    const { imeis, reason = "" } = req.body;

    if (!Array.isArray(imeis) || imeis.length === 0) {
      return next(new AppError("IMEI list is required", 400));
    }

    const normalizedImeis = imeis.map((imei) => String(imei).trim());

    if (
      normalizedImeis.some((imei) => !imei) ||
      new Set(normalizedImeis).size !== normalizedImeis.length
    ) {
      return next(new AppError("Invalid or duplicate IMEI", 400));
    }

    let updatedSale;

    await session.withTransaction(async () => {
      const sale = await Sale.findById(req.params.id).session(session);

      if (!sale) {
        throw new AppError("Sale not found", 404);
      }

      const alreadyReturned = new Set(
        sale.returnedItems.map((item) => item.imei)
      );

      const returnItems = normalizedImeis.map((imei) => {
        if (alreadyReturned.has(imei)) {
          throw new AppError(`Phone ${imei} has already been returned`, 400);
        }

        const item = sale.items.find((entry) => entry.imei === imei);

        if (!item) {
          throw new AppError(`Phone ${imei} does not belong to this sale`, 400);
        }

        return item;
      });

      const mobileIds = returnItems.map((item) => item.mobile);

      const updateResult = await Mobile.updateMany(
        {
          _id: { $in: mobileIds },
          status: "SOLD",
          sale: sale._id,
        },
        {
          $set: {
            status: "IN_STOCK",
            sale: null,
          },
        },
        { session }
      );

      if (updateResult.modifiedCount !== returnItems.length) {
        throw new AppError("Could not restore phone inventory", 409);
      }

      for (const item of returnItems) {
        sale.returnedItems.push({
          imei: item.imei,
          refundAmount: item.netAmount,
          returnedAt: new Date(),
          reason,
        });
      }

      sale.refundedAmount = Number(
        sale.returnedItems.reduce(
          (sum, item) => sum + item.refundAmount,
          0
        ).toFixed(2)
      );

      if (sale.returnedItems.length === sale.items.length) {
        sale.status = "RETURNED";
      } else {
        sale.status = "PARTIALLY_RETURNED";
      }

      await sale.save({ session });

      updatedSale = sale;
    });

    res.status(200).json({
      success: true,
      message: "Phone returned and inventory restored successfully",
      sale: updatedSale,
    });
  } catch (error) {
    next(error);
  } finally {
    await session.endSession();
  }
};
