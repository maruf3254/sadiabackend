
import crypto from "crypto";

const generateInvoice = (prefix) => {
  const date = new Date();
  const datePart = [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("");

  return `${prefix}-${datePart}-${crypto.randomBytes(4).toString("hex").toUpperCase()}`;
};

export default generateInvoice;
