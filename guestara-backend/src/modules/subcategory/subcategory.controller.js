const service = require("./subcategory.service");

function parseBool(v) {
  if (v === "true") return true;
  if (v === "false") return false;
  return undefined;
}

async function create(req, res, next) {
  try {
    const created = await service.createSubcategory(req.body);
    res.status(201).json(created);
  } catch (err) {
    if (err.code === 11000) {
      err.statusCode = 409;
      err.message = "Subcategory name must be unique under the same category";
    }
    next(err);
  }
}

async function list(req, res, next) {
  try {
    const { page, limit, sortBy, sortOrder, activeOnly, categoryId } = req.query;

    const data = await service.listSubcategories({
      page,
      limit,
      sortBy,
      sortOrder,
      activeOnly: parseBool(activeOnly),
      categoryId,
    });

    res.json(data);
  } catch (err) {
    next(err);
  }
}

async function getById(req, res, next) {
  try {
    const doc = await service.getSubcategoryById(req.params.id);
    if (!doc) return res.status(404).json({ message: "Subcategory not found" });
    res.json(doc);
  } catch (err) {
    next(err);
  }
}

async function update(req, res, next) {
  try {
    const doc = await service.updateSubcategory(req.params.id, req.body);
    if (!doc) return res.status(404).json({ message: "Subcategory not found" });
    res.json(doc);
  } catch (err) {
    if (err.code === 11000) {
      err.statusCode = 409;
      err.message = "Subcategory name must be unique under the same category";
    }
    next(err);
  }
}

async function deactivate(req, res, next) {
  try {
    const doc = await service.deactivateSubcategory(req.params.id);
    if (!doc) return res.status(404).json({ message: "Subcategory not found" });
    res.json(doc);
  } catch (err) {
    next(err);
  }
}

module.exports = { create, list, getById, update, deactivate };
