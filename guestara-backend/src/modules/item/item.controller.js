const service = require("./item.service");

function parseBool(v) {
  if (v === "true") return true;
  if (v === "false") return false;
  return undefined;
}

async function create(req, res, next) {
  try {
    const created = await service.createItem(req.body);
    res.status(201).json(created);
  } catch (err) {
    if (err.code === 11000) {
      err.statusCode = 409;
      err.message = "Item name must be unique under the same parent";
    }
    next(err);
  }
}

async function list(req, res, next) {
  try {
    const {
      page,
      limit,
      sortBy,
      sortOrder,
      activeOnly,
      categoryId,
      subcategoryId,
      q,
      minPrice,
      maxPrice,
      taxApplicable,
    } = req.query;

    const data = await service.listItems({
      page,
      limit,
      sortBy,
      sortOrder,
      activeOnly: parseBool(activeOnly),
      categoryId,
      subcategoryId,
      q,
      minPrice,
      maxPrice,
      taxApplicable: taxApplicable !== undefined ? parseBool(taxApplicable) : undefined,
    });

    res.json(data);
  } catch (err) {
    next(err);
  }
}


async function getById(req, res, next) {
  try {
    const doc = await service.getItemById(req.params.id);
    if (!doc) return res.status(404).json({ message: "Item not found" });
    res.json(doc);
  } catch (err) {
    next(err);
  }
}

async function update(req, res, next) {
  try {
    const doc = await service.updateItem(req.params.id, req.body);
    if (!doc) return res.status(404).json({ message: "Item not found" });
    res.json(doc);
  } catch (err) {
    if (err.code === 11000) {
      err.statusCode = 409;
      err.message = "Item name must be unique under the same parent";
    }
    next(err);
  }
}

async function deactivate(req, res, next) {
  try {
    const doc = await service.deactivateItem(req.params.id);
    if (!doc) return res.status(404).json({ message: "Item not found" });
    res.json(doc);
  } catch (err) {
    next(err);
  }
}

module.exports = { create, list, getById, update, deactivate };
