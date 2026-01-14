const Subcategory = require("./subcategory.model");
const Category = require("../category/category.model");

async function createSubcategory(payload) {
  // ensure parent category exists
  const exists = await Category.findById(payload.categoryId);
  if (!exists) {
    const err = new Error("Parent category not found");
    err.statusCode = 404;
    throw err;
  }

  return Subcategory.create(payload);
}

async function listSubcategories({
  page = 1,
  limit = 10,
  sortBy = "createdAt",
  sortOrder = "desc",
  activeOnly,
  categoryId,
} = {}) {
  const q = {};
  if (activeOnly === true) q.is_active = true;
  if (categoryId) q.categoryId = categoryId;

  const skip = (Number(page) - 1) * Number(limit);
  const sort = { [sortBy]: sortOrder === "asc" ? 1 : -1 };

  const [items, total] = await Promise.all([
    Subcategory.find(q).sort(sort).skip(skip).limit(Number(limit)),
    Subcategory.countDocuments(q),
  ]);

  return {
    items,
    page: Number(page),
    limit: Number(limit),
    total,
    totalPages: Math.ceil(total / Number(limit)),
  };
}

async function getSubcategoryById(id) {
  return Subcategory.findById(id);
}

async function updateSubcategory(id, payload) {
  return Subcategory.findByIdAndUpdate(id, payload, {
    new: true,
    runValidators: true,
  });
}

async function deactivateSubcategory(id) {
  return Subcategory.findByIdAndUpdate(id, { is_active: false }, { new: true });
}

module.exports = {
  createSubcategory,
  listSubcategories,
  getSubcategoryById,
  updateSubcategory,
  deactivateSubcategory,
};
