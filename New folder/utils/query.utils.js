
export const getPagination = (query) => {
  const page = Math.max(1, parseInt(query.page, 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(query.limit, 10) || 10));

  return {
    page,
    limit,
    skip: (page - 1) * limit,
  };
};

export const getDateFilter = (query, field = "createdAt") => {
  const filter = {};

  if (query.startDate || query.endDate) {
    filter[field] = {};

    if (query.startDate) {
      const start = new Date(query.startDate);
      if (Number.isNaN(start.getTime())) {
        throw new Error("Invalid startDate");
      }
      filter[field].$gte = start;
    }

    if (query.endDate) {
      const end = new Date(query.endDate);
      if (Number.isNaN(end.getTime())) {
        throw new Error("Invalid endDate");
      }
      end.setHours(23, 59, 59, 999);
      filter[field].$lte = end;
    }

    if (
      filter[field].$gte &&
      filter[field].$lte &&
      filter[field].$gte > filter[field].$lte
    ) {
      throw new Error("startDate cannot be after endDate");
    }
  }

  return filter;
};
