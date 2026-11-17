
import Mobile from "../models/mobile.model.js";
import AppError from "../utils/error.utils.js";
import { getPagination } from "../utils/query.utils.js";

// Get all phones
export const getAllMobiles = async (req, res, next) => {
  try {
    const { page, limit, skip } = getPagination(req.query);

    const filter = {};

    if (req.query.search) {
      filter.$or = [
        { brand: { $regex: req.query.search, $options: "i" } },
        { model: { $regex: req.query.search, $options: "i" } },
        { imei: { $regex: req.query.search, $options: "i" } },
      ];
    }

    if (req.query.status) {
      if (!["IN_STOCK", "SOLD"].includes(req.query.status)) {
        return next(new AppError("Invalid status", 400));
      }
      filter.status = req.query.status;
    }

    const [mobiles, total] = await Promise.all([
      Mobile.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit),
      Mobile.countDocuments(filter),
    ]);

    res.status(200).json({
      success: true,
      total,
      page,
      pages: Math.ceil(total / limit),
      mobiles,
    });
  } catch (error) {
    next(error);
  }
};

// Get single phone
export const getSingleMobile = async (req, res, next) => {
  try {
    const mobile = await Mobile.findById(req.params.id)
      .populate("purchase", "invoiceNumber purchaseDate")
      .populate("sale", "invoiceNumber saleDate");

    if (!mobile) {
      return next(new AppError("Mobile not found", 404));
    }

    res.status(200).json({ success: true, mobile });
  } catch (error) {
    next(error);
  }
};

// Update phone details
export const updateMobile = async (req, res, next) => {
  try {
    const allowedFields = [
      "brand",
      "model",
      "color",
      "ram",
      "storage",
      "sellingPrice",
      "warrantyMonths",
      "notes",
    ];

    const updates = {};

    for (const field of allowedFields) {
      if (req.body[field] !== undefined) {
        updates[field] = req.body[field];
      }
    }

    if (updates.sellingPrice !== undefined) {
      if (
        !Number.isFinite(Number(updates.sellingPrice)) ||
        Number(updates.sellingPrice) < 0
      ) {
        return next(new AppError("Invalid selling price", 400));
      }
      updates.sellingPrice = Number(updates.sellingPrice);
    }

    const mobile = await Mobile.findByIdAndUpdate(
      req.params.id,
      { $set: updates },
      { new: true, runValidators: true }
    );

    if (!mobile) {
      return next(new AppError("Mobile not found", 404));
    }

    res.status(200).json({
      success: true,
      message: "Mobile updated successfully",
      mobile,
    });
  } catch (error) {
    next(error);
  }
};

// Delete phone (only unsold phones)
export const deleteMobile = async (req, res, next) => {
  try {
    const mobile = await Mobile.findById(req.params.id);

    if (!mobile) {
      return next(new AppError("Mobile not found", 404));
    }

    if (mobile.status !== "IN_STOCK" || mobile.sale) {
      return next(
        new AppError("Cannot delete a sold mobile", 400)
      );
    }

    await mobile.deleteOne();

    res.status(200).json({
      success: true,
      message: "Mobile deleted successfully",
    });
  } catch (error) {
    next(error);
  }
};
