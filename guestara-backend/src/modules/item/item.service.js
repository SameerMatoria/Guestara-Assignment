const Item = require("./item.model");
const Category = require("../category/category.model");
const Subcategory = require("../subcategory/subcategory.model");

async function assertParentExists({ categoryId, subcategoryId }) {
  if (categoryId) {
    const cat = await Category.findById(categoryId);
    if (!cat) {
      const err = new Error("Parent category not found");
      err.statusCode = 404;
      throw err;
    }
  }
  if (subcategoryId) {
    const sub = await Subcategory.findById(subcategoryId);
    if (!sub) {
      const err = new Error("Parent subcategory not found");
      err.statusCode = 404;
      throw err;
    }
  }
}

async function createItem(payload) {
  await assertParentExists(payload);
  return Item.create(payload);
}

/**
 * "Effective active" logic:
 * Item is effectively active if:
 * - item.is_active = true
 * - AND its parent category is active
 * - AND if it has subcategory parent: subcategory is active too
 */
async function listItems({
  page = 1,
  limit = 10,
  sortBy = "createdAt",
  sortOrder = "desc",
  activeOnly,
  categoryId,
  subcategoryId,
  q,
} = {}) {
  const match = {};
  if (categoryId) match.categoryId = categoryId;
  if (subcategoryId) match.subcategoryId = subcategoryId;

  // optional text search
  if (q) match.$text = { $search: q };

  const skip = (Number(page) - 1) * Number(limit);
  const sort = { [sortBy]: sortOrder === "asc" ? 1 : -1 };

  // We use aggregation to apply parent active constraints in one query.
  // This helps us satisfy "category inactive => items behave inactive" without updating each item row.
  const pipeline = [
    { $match: match },

    // join category
    {
      $lookup: {
        from: "categories",
        localField: "categoryId",
        foreignField: "_id",
        as: "cat",
      },
    },
    { $unwind: { path: "$cat", preserveNullAndEmptyArrays: true } },

    // join subcategory
    {
      $lookup: {
        from: "subcategories",
        localField: "subcategoryId",
        foreignField: "_id",
        as: "sub",
      },
    },
    { $unwind: { path: "$sub", preserveNullAndEmptyArrays: true } },

    // derive effectiveIsActive
    {
      $addFields: {
        effectiveIsActive: {
          $and: [
            "$is_active",
            {
              $cond: [
                { $ifNull: ["$subcategoryId", false] }, // if subcategoryId exists
                { $and: ["$sub.is_active", "$cat.is_active"] },
                "$cat.is_active",
              ],
            },
          ],
        },
      },
    },
  ];

  if (activeOnly === true) {
    pipeline.push({ $match: { effectiveIsActive: true } });
  }

  pipeline.push(
    { $sort: sort },
    { $skip: skip },
    { $limit: Number(limit) }
  );

  const countPipeline = pipeline
    .filter((st) => !("$skip" in st || "$limit" in st || "$sort" in st))
    .concat([{ $count: "total" }]);

  const [items, countRes] = await Promise.all([
    Item.aggregate(pipeline),
    Item.aggregate(countPipeline),
  ]);

  const total = countRes?.[0]?.total || 0;

  return {
    items,
    page: Number(page),
    limit: Number(limit),
    total,
    totalPages: Math.ceil(total / Number(limit)),
  };
}

async function getItemById(id) {
  return Item.findById(id);
}

async function updateItem(id, payload) {
  // if parent is being changed, validate exists
  if (payload.categoryId || payload.subcategoryId) {
    await assertParentExists(payload);
  }

  return Item.findByIdAndUpdate(id, payload, {
    new: true,
    runValidators: true,
  });
}

async function deactivateItem(id) {
  return Item.findByIdAndUpdate(id, { is_active: false }, { new: true });
}

module.exports = {
  createItem,
  listItems,
  getItemById,
  updateItem,
  deactivateItem,
};
