const Category = require("./category.model");

async function createCategory(payload) {
  const doc = await Category.create(payload);
  return doc;
}

async function listCategories({ page = 1, limit = 10, sortBy = "createdAt", sortOrder = "desc", activeOnly } = {}) {
  const q = {};
  if (activeOnly === true) q.is_active = true;

  const skip = (Number(page) - 1) * Number(limit);

  const sort = { [sortBy]: sortOrder === "asc" ? 1 : -1 };

  const [items, total] = await Promise.all([
    Category.find(q).sort(sort).skip(skip).limit(Number(limit)),
    Category.countDocuments(q),
  ]);

  return {
    items,
    page: Number(page),
    limit: Number(limit),
    total,
    totalPages: Math.ceil(total / Number(limit)),
  };
}

async function getCategoryById(id) {
  const doc = await Category.findById(id);
  return doc;
}

// Soft delete
async function deactivateCategory(id) {
  const doc = await Category.findByIdAndUpdate(
    id,
    { is_active: false },
    { new: true }
  );
  return doc;
}

async function updateCategory(id, payload) {
  const doc = await Category.findByIdAndUpdate(id, payload, {
    new: true,
    runValidators: true,
  });
  return doc;
}

module.exports = {
  createCategory,
  listCategories,
  getCategoryById,
  deactivateCategory,
  updateCategory,
};
