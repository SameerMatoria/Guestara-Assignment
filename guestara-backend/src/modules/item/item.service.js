const mongoose = require("mongoose");
const Item = require("./item.model");
const Category = require("../category/category.model");
const Subcategory = require("../subcategory/subcategory.model");

function toObjectId(id) {
  if (!id) return null;
  if (!mongoose.Types.ObjectId.isValid(id)) return null;
  return new mongoose.Types.ObjectId(id);
}


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
  sortBy = "createdAt", // name | createdAt | price
  sortOrder = "desc",
  activeOnly,
  categoryId,
  subcategoryId,
  q,
  minPrice,
  maxPrice,
  taxApplicable,
} = {}) {
  const skip = (Number(page) - 1) * Number(limit);
  const sortDir = sortOrder === "asc" ? 1 : -1;

  const match = {};

  const categoryObjId = toObjectId(categoryId);
  const subcategoryObjId = toObjectId(subcategoryId);

  // Filter by subcategory (direct)
  if (subcategoryId) {
    if (!subcategoryObjId) {
      const err = new Error("Invalid subcategoryId");
      err.statusCode = 400;
      throw err;
    }
    match.subcategoryId = subcategoryObjId;
  }

  // Text search
  if (q) match.$text = { $search: q };

  const pipeline = [
    { $match: match },

    // join subcategory first (needed to resolve category for subcategory-items)
    {
      $lookup: {
        from: "subcategories",
        localField: "subcategoryId",
        foreignField: "_id",
        as: "sub",
      },
    },
    { $unwind: { path: "$sub", preserveNullAndEmptyArrays: true } },

    // Resolve categoryId for BOTH types of items:
    // - If item.categoryId exists -> use it
    // - Else use sub.categoryId (subcategory parent)
    {
      $addFields: {
        resolvedCategoryId: { $ifNull: ["$categoryId", "$sub.categoryId"] },
      },
    },

    // join category using resolvedCategoryId
    {
      $lookup: {
        from: "categories",
        localField: "resolvedCategoryId",
        foreignField: "_id",
        as: "cat",
      },
    },
    { $unwind: { path: "$cat", preserveNullAndEmptyArrays: true } },

    // Now category filter works for both direct-category items AND subcategory-items
    ...(categoryId
      ? [
          (() => {
            if (!categoryObjId) {
              const err = new Error("Invalid categoryId");
              err.statusCode = 400;
              throw err;
            }
            return { $match: { resolvedCategoryId: categoryObjId } };
          })(),
        ]
      : []),

    // effective active:
    // - item active
    // - category active
    // - if has subcategory, subcategory must be active too
    {
      $addFields: {
        effectiveIsActive: {
          $and: [
            "$is_active",
            "$cat.is_active",
            {
              $cond: [
                { $ifNull: ["$subcategoryId", false] },
                "$sub.is_active",
                true,
              ],
            },
          ],
        },
      },
    },
  ];

  // activeOnly filter
  if (activeOnly === true) {
    pipeline.push({ $match: { effectiveIsActive: true } });
  }

  // taxApplicable filter using inheritance:
  // if sub.tax_applicable != null => use it, else category.tax_applicable
  if (taxApplicable === true || taxApplicable === false) {
    pipeline.push({
      $addFields: {
        effectiveTaxApplicable: {
          $cond: [
            { $ne: ["$sub.tax_applicable", null] },
            "$sub.tax_applicable",
            "$cat.tax_applicable",
          ],
        },
      },
    });
    pipeline.push({ $match: { effectiveTaxApplicable: taxApplicable } });
  }

  // sortablePrice (STATIC/COMPLIMENTARY/DISCOUNTED only)
  pipeline.push({
    $addFields: {
      sortablePrice: {
        $switch: {
          branches: [
            { case: { $eq: ["$pricing_type", "STATIC"] }, then: "$pricing_config.price" },
            { case: { $eq: ["$pricing_type", "COMPLIMENTARY"] }, then: 0 },
            {
              case: { $eq: ["$pricing_type", "DISCOUNTED"] },
              then: {
                $let: {
                  vars: {
                    base: "$pricing_config.base_price",
                    dtype: "$pricing_config.discount_type",
                    dval: "$pricing_config.discount_value",
                  },
                  in: {
                    $max: [
                      0,
                      {
                        $subtract: [
                          "$$base",
                          {
                            $cond: [
                              { $eq: ["$$dtype", "FLAT"] },
                              "$$dval",
                              {
                                $cond: [
                                  { $eq: ["$$dtype", "PERCENT"] },
                                  { $divide: [{ $multiply: ["$$base", "$$dval"] }, 100] },
                                  0,
                                ],
                              },
                            ],
                          },
                        ],
                      },
                    ],
                  },
                },
              },
            },
          ],
          default: null,
        },
      },
    },
  });

  // price range
  if (minPrice !== undefined || maxPrice !== undefined) {
    const pr = {};
    if (minPrice !== undefined) pr.$gte = Number(minPrice);
    if (maxPrice !== undefined) pr.$lte = Number(maxPrice);

    pipeline.push({
      $match: { sortablePrice: { $ne: null, ...pr } },
    });
  }

  // sorting
  const sortStage = {};
  if (sortBy === "name") sortStage.name = sortDir;
  else if (sortBy === "createdAt") sortStage.createdAt = sortDir;
  else if (sortBy === "price") {
    sortStage.sortablePrice = sortDir;
    sortStage.createdAt = -1;
  } else {
    sortStage.createdAt = -1;
  }

  const dataPipeline = [
    ...pipeline,
    { $sort: sortStage },
    { $skip: skip },
    { $limit: Number(limit) },
    {
      $project: {
        cat: 0,
        sub: 0,
      },
    },
  ];

  const countPipeline = [...pipeline, { $count: "total" }];

  const [items, countRes] = await Promise.all([
    Item.aggregate(dataPipeline),
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
