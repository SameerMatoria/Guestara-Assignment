const categoryService = require("./category.service");

function parseBool(v) {
  if (v === "true") return true;
  if (v === "false") return false;
  return undefined;
}

async function create(req, res, next) {
  try {
    const created = await categoryService.createCategory(req.body);
    res.status(201).json(created);
  } catch (err) {
    // handle duplicate key nicely
    if (err.code === 11000) {
      err.statusCode = 409;
      err.message = "Category name must be unique per restaurant";
    }
    next(err);
  }
}

async function list(req, res, next) {
  try {
    const { page, limit, sortBy, sortOrder, activeOnly } = req.query;

    const data = await categoryService.listCategories({
      page,
      limit,
      sortBy,
      sortOrder,
      activeOnly: parseBool(activeOnly),
    });

    res.json(data);
  } catch (err) {
    next(err);
  }
}

async function getById(req, res, next) {
  try {
    const doc = await categoryService.getCategoryById(req.params.id);
    if (!doc) return res.status(404).json({ message: "Category not found" });
    res.json(doc);
  } catch (err) {
    next(err);
  }
}

async function update(req, res, next) {
  try {
    const doc = await categoryService.updateCategory(req.params.id, req.body);
    if (!doc) return res.status(404).json({ message: "Category not found" });
    res.json(doc);
  } catch (err) {
    if (err.code === 11000) {
      err.statusCode = 409;
      err.message = "Category name must be unique";
    }
    next(err);
  }
}

async function deactivate(req, res, next) {
  try {
    const doc = await categoryService.deactivateCategory(req.params.id);
    if (!doc) return res.status(404).json({ message: "Category not found" });
    res.json(doc);
  } catch (err) {
    next(err);
  }
}

module.exports = { create, list, getById, update, deactivate };
