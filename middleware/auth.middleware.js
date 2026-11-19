
import AppError from "../utils/error.utils.js";
import jwt from "jsonwebtoken";
import userModel from "../models/user.model.js";

// ===============================
// Authentication Middleware
// ===============================
// const isLoggedIn = async (req, res, next) => {
//   try {
//     // Get token from cookies
//     const token = req.cookies?.token;



//     console.log(token)

//     // Debug logs
//     console.log("Request URL:", req.originalUrl);
//     console.log("Cookie received:", Boolean(token));

//     // Check token
//     if (!token) {
//       return next(
//         new AppError("Unauthenticated, please login againnnn", 401)
//       );
//     }

//     // Verify JWT
//     const userDetails = jwt.verify(
//       token,
//       process.env.JWT_SECRET
//     );

//     // Attach user details
//     req.user = userDetails;

//     next();
//   } catch (error) {
//     console.error("Authentication Error:", error.message);

//     if (error.name === "TokenExpiredError") {
//       return next(
//         new AppError("Session expired, please login again", 401)
//       );
//     }

//     if (error.name === "JsonWebTokenError") {
//       return next(
//         new AppError("Invalid token, please login again", 401)
//       );
//     }

//     return next(
//       new AppError("Authentication failed", 401)
//     );
//   }
// };


const isLoggedIn = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    const bearerToken =
      authHeader && /^Bearer\s+/i.test(authHeader)
        ? authHeader.replace(/^Bearer\s+/i, "").trim()
        : null;

    const token = req.cookies?.token || bearerToken;

    if (!token) {
      return next(new AppError("Unauthenticated, please login again", 401));
    }

    const userDetails = jwt.verify(token, process.env.JWT_SECRET);
    req.user = userDetails;
    next();
  } catch (error) {
    console.error("Authentication Error:", error.message);

    if (error.name === "TokenExpiredError") {
      return next(
        new AppError("Session expired, please login again", 401)
      );
    }

    if (error.name === "JsonWebTokenError") {
      return next(
        new AppError("Invalid token, please login again", 401)
      );
    }

    return next(
      new AppError("Authentication failed", 401)
    );
  }
};


// ===============================
// Authorized Roles Middleware
// ===============================
const authorisedRoles =
  (...roles) =>
    async (req, res, next) => {
      try {
        const { id } = req.user;

        const user = await userModel.findById(id);

        if (!user) {
          return next(
            new AppError("User not found", 404)
          );
        }

        const currentUserRoles = req.user.role;

        if (
          !roles.includes(currentUserRoles) ||
          user.role !== currentUserRoles
        ) {
          return next(
            new AppError(
              "You do not have permission to access this route",
              403
            )
          );
        }

        next();
      } catch (error) {
        return next(error);
      }
    };


// ===============================
// Subscriber Authorization
// ===============================
const authorizeSubscriber = async (req, res, next) => {
  try {
    const { role, id } = req.user;
    const { catId } = req.params;

    const user = await userModel
      .findById(id)
      .select("subscribe");

    if (!user) {
      return next(
        new AppError("User not found", 404)
      );
    }

    if (
      role === "ADMIN" ||
      role === "INSTRUCTOR" ||
      user.subscribe?.includes(catId)
    ) {
      return next();
    }

    return next(
      new AppError(
        "Please subscribe to access this route!",
        403
      )
    );

  } catch (error) {
    console.error("Subscriber Authorization Error:", error);

    return next(
      new AppError("Server error", 500)
    );
  }
};


export {
  isLoggedIn,
  authorisedRoles,
  authorizeSubscriber,
};
